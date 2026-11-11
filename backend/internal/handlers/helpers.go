// Package handlers implements the HTTP layer for the Kumbuild auth API:
// JSON handlers only. Router wiring lives in internal/server.
package handlers

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net"
	"net/http"
	"net/netip"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/dusmamud/kumbuild/backend/internal/auth"
	"github.com/dusmamud/kumbuild/backend/internal/config"
	"github.com/dusmamud/kumbuild/backend/internal/csrf"
	"github.com/dusmamud/kumbuild/backend/internal/mailer"
	"github.com/dusmamud/kumbuild/backend/internal/middleware"
	"github.com/dusmamud/kumbuild/backend/internal/ratelimit"
	"github.com/dusmamud/kumbuild/backend/internal/store"
	"github.com/dusmamud/kumbuild/backend/internal/turnstile"
)

// maxJSONBodyBytes caps request bodies at 1MB.
const maxJSONBodyBytes = 1 << 20

// Handler carries every dependency a handler needs.
type Handler struct {
	Cfg       *config.Config
	Users     store.UserStore
	Billing   store.BillingStore
	Sessions  store.SessionStore
	Tokens    store.TokenStore
	Audit     store.AuditStore
	Notes     store.NoteStore
	Mailer    mailer.Mailer
	Turnstile turnstile.Verifier
	Limiter   *ratelimit.Limiter
}

// decodeJSON decodes the request body into dst with a 1MB limit.
// Bad JSON (or trailing data) writes 400 "invalid-json" and returns false.
func decodeJSON(w http.ResponseWriter, r *http.Request, dst any) bool {
	r.Body = http.MaxBytesReader(w, r.Body, maxJSONBodyBytes)
	dec := json.NewDecoder(r.Body)
	if err := dec.Decode(dst); err != nil {
		middleware.WriteError(w, http.StatusBadRequest, "invalid-json", "request body is not valid JSON")
		return false
	}
	if err := dec.Decode(&struct{}{}); err != io.EOF {
		middleware.WriteError(w, http.StatusBadRequest, "invalid-json", "request body is not valid JSON")
		return false
	}
	return true
}

// pageParams reads ?page=&limit= with defaults 1/20; limit clamps at 100.
func pageParams(r *http.Request) (page, limit int) {
	page, limit = 1, 20
	q := r.URL.Query()
	if v := q.Get("page"); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n >= 1 {
			page = n
		}
	}
	if v := q.Get("limit"); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n >= 1 {
			if n > 100 {
				n = 100
			}
			limit = n
		}
	}
	return page, limit
}

// totalPages computes the page count for a list response (0 when empty).
func totalPages(total, limit int) int {
	if total <= 0 || limit <= 0 {
		return 0
	}
	return (total + limit - 1) / limit
}

// ClientIP returns the client IP: CF-Connecting-IP first, then the first
// X-Forwarded-For entry, then the RemoteAddr host.
func ClientIP(r *http.Request) string {
	if ip := strings.TrimSpace(r.Header.Get("CF-Connecting-IP")); ip != "" {
		return ip
	}
	if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
		if first, _, ok := strings.Cut(xff, ","); ok {
			return strings.TrimSpace(first)
		}
		return strings.TrimSpace(xff)
	}
	if host, _, err := net.SplitHostPort(r.RemoteAddr); err == nil {
		return host
	}
	return strings.TrimSpace(r.RemoteAddr)
}

// currentUser returns the authenticated user from the middleware context.
func currentUser(r *http.Request) *store.User {
	u, _ := middleware.UserFromContext(r.Context())
	return u
}

// writeValidationError writes 400 "validation-failed" with the field map.
func writeValidationError(w http.ResponseWriter, fields map[string]string) {
	keys := make([]string, 0, len(fields))
	for k := range fields {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	msg := "validation failed"
	if len(keys) > 0 {
		msg = fmt.Sprintf("validation failed: %s (%s)", keys[0], fields[keys[0]])
	}
	middleware.WriteJSON(w, http.StatusBadRequest, map[string]any{
		"error":   "validation-failed",
		"message": msg,
		"fields":  fields,
	})
}

// writeInternal writes the generic 500 envelope (never leaks internals).
func writeInternal(w http.ResponseWriter, r *http.Request, err error, what string) {
	slog.Error(what, "error", err, "path", r.URL.Path)
	middleware.WriteError(w, http.StatusInternalServerError, "internal-error", "internal error")
}

// verifyTurnstile enforces the Turnstile gate: missing token -> 400
// "turnstile-required"; failed or unverifiable token -> 403
// "turnstile-failed" (fail closed). Returns false after writing the error.
func (h *Handler) verifyTurnstile(w http.ResponseWriter, r *http.Request, token string) bool {
	if strings.TrimSpace(token) == "" {
		middleware.WriteError(w, http.StatusBadRequest, "turnstile-required", "turnstile token is required")
		return false
	}
	ok, err := h.Turnstile.Verify(r.Context(), token, ClientIP(r))
	if err != nil {
		slog.Warn("turnstile: verification error, failing closed", "error", err, "path", r.URL.Path, "ip", ClientIP(r))
		middleware.WriteError(w, http.StatusForbidden, "turnstile-failed", "turnstile verification failed")
		return false
	}
	if !ok {
		middleware.WriteError(w, http.StatusForbidden, "turnstile-failed", "turnstile verification failed")
		return false
	}
	return true
}

// checkLimit runs one rate-limit check: Redis error -> 503
// "rate-limit-unavailable" (fail safe, never bypass); over limit -> 429
// "rate-limited". Returns false after writing the error.
func (h *Handler) checkLimit(w http.ResponseWriter, r *http.Request, allow func(context.Context) (bool, error)) bool {
	ok, err := allow(r.Context())
	if err != nil {
		slog.Warn("rate limit unavailable, failing safe", "error", err, "path", r.URL.Path)
		middleware.WriteError(w, http.StatusServiceUnavailable, "rate-limit-unavailable", "rate limiting is unavailable, try again later")
		return false
	}
	if !ok {
		middleware.WriteError(w, http.StatusTooManyRequests, "rate-limited", "too many requests, try again later")
		return false
	}
	return true
}

// createSession mints a new session for userID and sets the session cookie
// plus a fresh (rotated) CSRF cookie.
func (h *Handler) createSession(w http.ResponseWriter, r *http.Request, userID string) error {
	csrfToken, err := csrf.NewToken()
	if err != nil {
		return err
	}
	token, err := auth.NewSessionToken()
	if err != nil {
		return err
	}
	now := time.Now()
	ip, _ := netip.ParseAddr(ClientIP(r))
	var ua *string
	if s := strings.TrimSpace(r.UserAgent()); s != "" {
		ua = &s
	}
	if err := h.Sessions.Create(r.Context(), &store.Session{
		UserID:     userID,
		TokenHash:  auth.HashToken(token),
		ExpiresAt:  now.Add(store.SessionAbsoluteTTL),
		LastSeenAt: now,
		IP:         ip,
		UserAgent:  ua,
	}); err != nil {
		return err
	}
	http.SetCookie(w, auth.CookieForSession(token, h.Cfg))
	csrf.SetCookie(w, csrfToken, h.Cfg)
	return nil
}

// hasSessionForUser reports whether the request already carries a live
// session row for userID (used by verify-email to keep the signup session).
func (h *Handler) hasSessionForUser(r *http.Request, userID string) bool {
	c, err := r.Cookie(auth.SessionCookieName)
	if err != nil || c.Value == "" {
		return false
	}
	sess, err := h.Sessions.GetByTokenHash(r.Context(), auth.HashToken(c.Value))
	if err != nil || sess.UserID != userID {
		return false
	}
	now := time.Now()
	return now.Before(sess.ExpiresAt) && now.Before(sess.LastSeenAt.Add(store.SessionIdleTTL))
}

// clearCSRFCookie expires the csrf_token cookie on the browser.
func clearCSRFCookie(cfg *config.Config) *http.Cookie {
	sameSite := http.SameSiteNoneMode
	if cfg.IsProd() {
		sameSite = http.SameSiteLaxMode
	}
	return &http.Cookie{
		Name:     csrf.CookieName,
		Value:    "",
		Path:     "/",
		Domain:   cfg.CookieDomain,
		MaxAge:   -1,
		Expires:  time.Unix(0, 0),
		HttpOnly: false,
		Secure:   true,
		SameSite: sameSite,
	}
}

// randomToken returns 32 crypto-random bytes, base64.RawURLEncoding
// (reset / invite tokens).
func randomToken() (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(b), nil
}

// createToken stores a hashed token of kind with ttl and returns the row
// plus the raw token (the raw value is only ever sent by email).
func (h *Handler) createToken(ctx context.Context, userID, kind string, ttl time.Duration) (*store.AuthToken, string, error) {
	raw, err := randomToken()
	if err != nil {
		return nil, "", err
	}
	t := &store.AuthToken{
		UserID:    userID,
		Kind:      kind,
		TokenHash: auth.HashToken(raw),
		ExpiresAt: time.Now().Add(ttl),
	}
	if err := h.Tokens.Create(ctx, t); err != nil {
		return nil, "", err
	}
	return t, raw, nil
}

// createOTP stores a hashed 6-digit OTP (10 min) and returns the code.
func (h *Handler) createOTP(ctx context.Context, userID string) (string, error) {
	code, err := auth.GenerateOTP()
	if err != nil {
		return "", err
	}
	t := &store.AuthToken{
		UserID:    userID,
		Kind:      store.TokenKindOTP,
		TokenHash: auth.HashOTP(code),
		ExpiresAt: time.Now().Add(store.OTPTTL),
	}
	if err := h.Tokens.Create(ctx, t); err != nil {
		return "", err
	}
	return code, nil
}

// sendOTPEmail sends the verification-code mail (failure is the caller's
// problem — never a fake success).
func (h *Handler) sendOTPEmail(ctx context.Context, u *store.User, code string) error {
	return h.Mailer.SendTransactional(ctx, u.Email, u.FullName,
		"Your Kumbuild verification code",
		mailer.OTPEmailHTML(code),
		"Your Kumbuild verification code is: "+code+". Valid for 10 minutes.")
}

// sendInviteEmail sends the staff invite mail with the accept-invite link.
func (h *Handler) sendInviteEmail(ctx context.Context, u *store.User, token string) error {
	link := strings.TrimRight(h.Cfg.AppBaseURL, "/") + "/accept-invite?token=" + token
	return h.Mailer.SendTransactional(ctx, u.Email, u.FullName,
		"You're invited to join Kumbuild",
		mailer.InviteEmailHTML(link, u.FullName),
		"Set your Kumbuild password here: "+link+". The link is valid for 24 hours.")
}

// sendResetEmail sends the password-reset mail with the reset link.
func (h *Handler) sendResetEmail(ctx context.Context, u *store.User, token string) error {
	link := strings.TrimRight(h.Cfg.AppBaseURL, "/") + "/reset-password?token=" + token
	return h.Mailer.SendTransactional(ctx, u.Email, u.FullName,
		"Reset your Kumbuild password",
		mailer.ResetEmailHTML(link, u.FullName),
		"Reset your Kumbuild password here: "+link+". The link is valid for 30 minutes.")
}

// emailKeyHash returns the SHA-256 hex of a lowercased email (raw emails
// are never used as Redis keys).
func emailKeyHash(email string) string {
	sum := sha256.Sum256([]byte(strings.ToLower(strings.TrimSpace(email))))
	return hex.EncodeToString(sum[:])
}

// roleStatusDetails builds the audit Details JSON for user-management
// actions: before/after role+status.
func roleStatusDetails(beforeRole, beforeStatus, afterRole, afterStatus string) map[string]any {
	return map[string]any{
		"before": map[string]string{"role": beforeRole, "status": beforeStatus},
		"after":  map[string]string{"role": afterRole, "status": afterStatus},
	}
}

// audit writes one audit row (standalone — the stores expose no shared tx,
// so audit-first/same-tx is not possible; see report).
func (h *Handler) audit(ctx context.Context, r *http.Request, actorID, action, targetID string, details map[string]any) error {
	ip, _ := netip.ParseAddr(ClientIP(r))
	var actor, target *string
	if actorID != "" {
		actor = &actorID
	}
	if targetID != "" {
		target = &targetID
	}
	return h.Audit.Insert(ctx, nil, &store.AuditLog{
		ActorUserID:  actor,
		Action:       action,
		TargetUserID: target,
		Details:      details,
		IP:           ip,
	})
}
