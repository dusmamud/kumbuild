package handlers

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/dusmamud/kumbuild/backend/internal/auth"
	"github.com/dusmamud/kumbuild/backend/internal/csrf"
	"github.com/dusmamud/kumbuild/backend/internal/middleware"
	"github.com/dusmamud/kumbuild/backend/internal/store"
	"github.com/jackc/pgx/v5/pgconn"
)

// isUniqueViolation reports whether err is a Postgres unique violation
// (code 23505) — the backstop for the exists pre-check racing a concurrent
// insert.
func isUniqueViolation(err error) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && pgErr.Code == "23505"
}

// checkNewPassword runs the shared password policy + HIBP breach check.
// Returns false after writing a 400 validation error.
func (h *Handler) checkNewPassword(w http.ResponseWriter, r *http.Request, password, field string) bool {
	if code, _ := auth.ValidatePasswordPolicy(password); code != "" {
		writeValidationError(w, map[string]string{field: code})
		return false
	}
	if breached, _ := auth.CheckHIBP(r.Context(), password); breached {
		writeValidationError(w, map[string]string{field: auth.CodeWeakPassword})
		return false
	}
	return true
}

// Signup creates a customer account (role forced to customer), emails the
// OTP, and sets the session cookie. The session is unusable until the OTP
// is verified because RequireAuth requires status active.
func (h *Handler) Signup(w http.ResponseWriter, r *http.Request) {
	var req userFieldsRequest
	if !decodeJSON(w, r, &req) {
		return
	}
	if !h.verifyTurnstile(w, r, req.TurnstileToken) {
		return
	}
	ip := ClientIP(r)
	if !h.checkLimit(w, r, func(ctx context.Context) (bool, error) {
		return h.Limiter.AllowSignupByIP(ctx, ip)
	}) {
		return
	}
	// Public signup collects NO billing address (removed 2026-11-12 —
	// minimal-field registration; billing is captured later, e.g. by an
	// admin or a profile flow). Any billing fields in the payload are
	// IGNORED: not validated, not stored (HasBilling=false, nil billing
	// to store.Create below).
	in := req.toSignupInput(false)
	if errs := auth.ValidateSignupInput(in); len(errs) > 0 {
		writeValidationError(w, errs)
		return
	}
	// Exists is checked before hashing: fail fast, don't burn Argon2id.
	exists, err := h.Users.ExistsByEmail(r.Context(), strings.TrimSpace(req.Email))
	if err != nil {
		writeInternal(w, r, err, "signup: exists check failed")
		return
	}
	if exists {
		middleware.WriteError(w, http.StatusConflict, "exists", "an account with this email already exists")
		return
	}
	if !h.checkNewPassword(w, r, req.Password, "password") {
		return
	}
	hash, err := auth.HashPassword(req.Password)
	if err != nil {
		writeInternal(w, r, err, "signup: hash failed")
		return
	}
	u := &store.User{
		FullName: strings.TrimSpace(req.FullName),
		Email:    strings.TrimSpace(req.Email),
		// Contact numbers are stored ONLY in E.164 form (normalised
		// from whatever shape was typed; validation already passed).
		PhoneNo:    in.NormalizedPhone(),
		WhatsAppNo: in.NormalizedWhatsApp(),
		Role:       store.RoleCustomer,
		Status:     store.StatusPending,
	}
	if alt := strings.TrimSpace(req.AlternativeEmail); alt != "" {
		u.AlternativeEmail = &alt
	}
	// No billing address at signup: nil billing (store.Create handles
	// it — staff/seed users are created the same way).
	if err := h.Users.Create(r.Context(), u, hash, nil); err != nil {
		if isUniqueViolation(err) {
			middleware.WriteError(w, http.StatusConflict, "exists", "an account with this email already exists")
			return
		}
		writeInternal(w, r, err, "signup: create failed")
		return
	}
	code, err := h.createOTP(r.Context(), u.ID)
	if err != nil {
		writeInternal(w, r, err, "signup: otp create failed")
		return
	}
	// Mail failure is a 500, never a fake success — the user row stays and
	// resend-otp can be used later.
	if err := h.sendOTPEmail(r.Context(), u, code); err != nil {
		slog.Error("signup: otp email failed", "error", err, "user_id", u.ID)
		middleware.WriteError(w, http.StatusInternalServerError, "email-failed", "could not send verification email, try resending the code later")
		return
	}
	if err := h.createSession(w, r, u.ID); err != nil {
		writeInternal(w, r, err, "signup: session create failed")
		return
	}
	middleware.WriteJSON(w, http.StatusCreated, map[string]any{"user": u})
}

// VerifyEmail verifies the signup OTP. No Turnstile here (not in the plan
// for this endpoint). Wrong/unknown -> 400 "invalid-code" for every case —
// no enumeration.
func (h *Handler) VerifyEmail(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Email string `json:"email"`
		Code  string `json:"code"`
	}
	if !decodeJSON(w, r, &req) {
		return
	}
	email := strings.TrimSpace(req.Email)
	code := strings.TrimSpace(req.Code)
	if email == "" || code == "" {
		middleware.WriteError(w, http.StatusBadRequest, "invalid-code", "invalid verification code")
		return
	}
	u, err := h.Users.GetByEmail(r.Context(), email)
	if err != nil || u.Status != store.StatusPending {
		// Same message for unknown email / wrong status: no enumeration.
		middleware.WriteError(w, http.StatusBadRequest, "invalid-code", "invalid verification code")
		return
	}
	ok, err := h.Limiter.AllowOTPAttempt(r.Context(), u.ID)
	if err != nil {
		slog.Warn("verify-email: otp counter unavailable", "error", err)
		middleware.WriteError(w, http.StatusServiceUnavailable, "rate-limit-unavailable", "rate limiting is unavailable, try again later")
		return
	}
	if !ok {
		// Counter exhausted: kill the code so a later guess cannot land.
		_ = h.Tokens.InvalidateKindForUser(r.Context(), u.ID, store.TokenKindOTP)
		middleware.WriteError(w, http.StatusTooManyRequests, "too-many-attempts", "too many attempts, request a new code")
		return
	}
	tok, err := h.Tokens.GetValidByHash(r.Context(), store.TokenKindOTP, auth.HashOTP(code))
	if err != nil || tok.UserID != u.ID {
		middleware.WriteError(w, http.StatusBadRequest, "invalid-code", "invalid verification code")
		return
	}
	if err := h.Tokens.MarkUsed(r.Context(), tok.ID); err != nil {
		writeInternal(w, r, err, "verify-email: mark used failed")
		return
	}
	if err := h.Users.SetEmailVerified(r.Context(), u.ID); err != nil {
		writeInternal(w, r, err, "verify-email: set verified failed")
		return
	}
	u, err = h.Users.GetByID(r.Context(), u.ID)
	if err != nil {
		writeInternal(w, r, err, "verify-email: reload failed")
		return
	}
	// Keep the signup session if this request already carries one for
	// this user; otherwise mint a fresh session.
	if !h.hasSessionForUser(r, u.ID) {
		if err := h.createSession(w, r, u.ID); err != nil {
			writeInternal(w, r, err, "verify-email: session create failed")
			return
		}
	}
	middleware.WriteJSON(w, http.StatusOK, map[string]any{"user": u})
}

// ResendOTP issues a fresh OTP for a pending user. Any other case returns
// the same generic 200 — no enumeration.
func (h *Handler) ResendOTP(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Email string `json:"email"`
	}
	if !decodeJSON(w, r, &req) {
		return
	}
	email := strings.TrimSpace(req.Email)
	ip := ClientIP(r)
	if !h.checkLimit(w, r, func(ctx context.Context) (bool, error) {
		return h.Limiter.Check(ctx, "rl:resend-otp:ip:"+ip, 5, time.Minute)
	}) {
		return
	}
	if !h.checkLimit(w, r, func(ctx context.Context) (bool, error) {
		return h.Limiter.Check(ctx, "rl:resend-otp:email:"+emailKeyHash(email), 5, time.Minute)
	}) {
		return
	}
	const generic = "if your account is pending verification, a new code was sent"
	u, err := h.Users.GetByEmail(r.Context(), email)
	if err != nil || u.Status != store.StatusPending {
		middleware.WriteJSON(w, http.StatusOK, map[string]string{"message": generic})
		return
	}
	if err := h.Tokens.InvalidateKindForUser(r.Context(), u.ID, store.TokenKindOTP); err != nil {
		writeInternal(w, r, err, "resend-otp: invalidate failed")
		return
	}
	code, err := h.createOTP(r.Context(), u.ID)
	if err != nil {
		writeInternal(w, r, err, "resend-otp: otp create failed")
		return
	}
	if err := h.sendOTPEmail(r.Context(), u, code); err != nil {
		slog.Error("resend-otp: otp email failed", "error", err, "user_id", u.ID)
		middleware.WriteError(w, http.StatusInternalServerError, "email-failed", "could not send verification email, try again later")
		return
	}
	middleware.WriteJSON(w, http.StatusOK, map[string]string{"message": generic})
}

// Login authenticates an active user. Unknown email, wrong password and
// non-active status all collapse to the same 401 — no enumeration.
func (h *Handler) Login(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Email          string `json:"email"`
		Password       string `json:"password"`
		TurnstileToken string `json:"turnstile_token"`
	}
	if !decodeJSON(w, r, &req) {
		return
	}
	if !h.verifyTurnstile(w, r, req.TurnstileToken) {
		return
	}
	ip := ClientIP(r)
	if !h.checkLimit(w, r, func(ctx context.Context) (bool, error) {
		return h.Limiter.AllowLoginByIP(ctx, ip)
	}) {
		return
	}
	email := strings.TrimSpace(req.Email)
	if !h.checkLimit(w, r, func(ctx context.Context) (bool, error) {
		return h.Limiter.AllowLoginByEmail(ctx, email)
	}) {
		return
	}
	const msg = "invalid credentials"
	u, err := h.Users.GetByEmail(r.Context(), email)
	if err != nil || u.Status != store.StatusActive {
		middleware.WriteError(w, http.StatusUnauthorized, "invalid-credentials", msg)
		return
	}
	ok, _ := auth.VerifyPassword(req.Password, u.PasswordHash)
	if !ok {
		middleware.WriteError(w, http.StatusUnauthorized, "invalid-credentials", msg)
		return
	}
	// New session token on every login (fixation protection + regeneration).
	if err := h.createSession(w, r, u.ID); err != nil {
		writeInternal(w, r, err, "login: session create failed")
		return
	}
	middleware.WriteJSON(w, http.StatusOK, map[string]any{"user": u})
}

// Logout deletes the server-side session and clears both cookies.
func (h *Handler) Logout(w http.ResponseWriter, r *http.Request) {
	if c, err := r.Cookie(auth.SessionCookieName); err == nil && c.Value != "" {
		if sess, err := h.Sessions.GetByTokenHash(r.Context(), auth.HashToken(c.Value)); err == nil {
			_ = h.Sessions.Delete(r.Context(), sess.ID)
		}
	}
	http.SetCookie(w, auth.ClearSessionCookie(h.Cfg))
	http.SetCookie(w, clearCSRFCookie(h.Cfg))
	middleware.WriteJSON(w, http.StatusOK, map[string]string{"message": "logged out"})
}

// Me returns the authenticated user, plus their billing address when one
// exists (null otherwise).
func (h *Handler) Me(w http.ResponseWriter, r *http.Request) {
	u := currentUser(r)
	if u == nil {
		middleware.WriteError(w, http.StatusUnauthorized, "unauthorized", "authentication required")
		return
	}
	var billing *store.BillingAddress
	b, err := h.Billing.GetByUserID(r.Context(), u.ID)
	if err != nil && !errors.Is(err, store.ErrNotFound()) {
		writeInternal(w, r, err, "me: billing lookup failed")
		return
	}
	if err == nil {
		billing = b
	}
	middleware.WriteJSON(w, http.StatusOK, map[string]any{"user": u, "billing_address": billing})
}

// ForgotPassword always returns 200 generic — existence is never leaked.
// Mail failure is logged only; the response stays 200.
func (h *Handler) ForgotPassword(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Email          string `json:"email"`
		TurnstileToken string `json:"turnstile_token"`
	}
	if !decodeJSON(w, r, &req) {
		return
	}
	if !h.verifyTurnstile(w, r, req.TurnstileToken) {
		return
	}
	ip := ClientIP(r)
	if !h.checkLimit(w, r, func(ctx context.Context) (bool, error) {
		return h.Limiter.AllowForgotByIP(ctx, ip)
	}) {
		return
	}
	const generic = "if an account exists for this email, a password reset link was sent"
	u, err := h.Users.GetByEmail(r.Context(), strings.TrimSpace(req.Email))
	if err != nil || u.Status == store.StatusDisabled {
		// Disabled users get nothing (a reset mail would be useless).
		middleware.WriteJSON(w, http.StatusOK, map[string]string{"message": generic})
		return
	}
	_ = h.Tokens.InvalidateKindForUser(r.Context(), u.ID, store.TokenKindReset)
	_, raw, err := h.createToken(r.Context(), u.ID, store.TokenKindReset, store.ResetTTL)
	if err != nil {
		slog.Error("forgot-password: token create failed", "error", err, "user_id", u.ID)
		middleware.WriteJSON(w, http.StatusOK, map[string]string{"message": generic})
		return
	}
	if err := h.sendResetEmail(r.Context(), u, raw); err != nil {
		slog.Error("forgot-password: reset email failed", "error", err, "user_id", u.ID)
	}
	middleware.WriteJSON(w, http.StatusOK, map[string]string{"message": generic})
}

// ResetPassword resets the password with a kind=reset token (an invite
// token is rejected). All sessions are invalidated.
func (h *Handler) ResetPassword(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Token          string `json:"token"`
		NewPassword    string `json:"newPassword"`
		TurnstileToken string `json:"turnstile_token"`
	}
	if !decodeJSON(w, r, &req) {
		return
	}
	if !h.verifyTurnstile(w, r, req.TurnstileToken) {
		return
	}
	ip := ClientIP(r)
	if !h.checkLimit(w, r, func(ctx context.Context) (bool, error) {
		return h.Limiter.Check(ctx, "rl:reset:ip:"+ip, 5, time.Minute)
	}) {
		return
	}
	if !h.checkNewPassword(w, r, req.NewPassword, "newPassword") {
		return
	}
	tok, err := h.Tokens.GetValidByHash(r.Context(), store.TokenKindReset, auth.HashToken(strings.TrimSpace(req.Token)))
	if err != nil {
		middleware.WriteError(w, http.StatusBadRequest, "invalid-token", "invalid or expired reset token")
		return
	}
	u, err := h.Users.GetByID(r.Context(), tok.UserID)
	if err != nil {
		middleware.WriteError(w, http.StatusBadRequest, "invalid-token", "invalid or expired reset token")
		return
	}
	hash, err := auth.HashPassword(req.NewPassword)
	if err != nil {
		writeInternal(w, r, err, "reset-password: hash failed")
		return
	}
	if err := h.Users.UpdatePasswordHash(r.Context(), u.ID, hash); err != nil {
		writeInternal(w, r, err, "reset-password: update failed")
		return
	}
	_ = h.Sessions.DeleteAllForUser(r.Context(), u.ID)
	if err := h.Tokens.MarkUsed(r.Context(), tok.ID); err != nil {
		slog.Warn("reset-password: mark used failed", "error", err, "token_id", tok.ID)
	}
	middleware.WriteJSON(w, http.StatusOK, map[string]string{"message": "password reset"})
}

// AcceptInvite sets the password for an invited staff user with a
// kind=invite token (a reset token is rejected). The user is auto-verified,
// becomes active, and is logged in (fresh session).
func (h *Handler) AcceptInvite(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Token          string `json:"token"`
		NewPassword    string `json:"newPassword"`
		TurnstileToken string `json:"turnstile_token"`
	}
	if !decodeJSON(w, r, &req) {
		return
	}
	if !h.verifyTurnstile(w, r, req.TurnstileToken) {
		return
	}
	ip := ClientIP(r)
	if !h.checkLimit(w, r, func(ctx context.Context) (bool, error) {
		return h.Limiter.AllowAcceptInviteByIP(ctx, ip)
	}) {
		return
	}
	if !h.checkNewPassword(w, r, req.NewPassword, "newPassword") {
		return
	}
	tok, err := h.Tokens.GetValidByHash(r.Context(), store.TokenKindInvite, auth.HashToken(strings.TrimSpace(req.Token)))
	if err != nil {
		middleware.WriteError(w, http.StatusBadRequest, "invalid-token", "invalid or expired invite token")
		return
	}
	u, err := h.Users.GetByID(r.Context(), tok.UserID)
	if err != nil || u.Status != store.StatusInvited {
		middleware.WriteError(w, http.StatusBadRequest, "invalid-token", "invalid or expired invite token")
		return
	}
	hash, err := auth.HashPassword(req.NewPassword)
	if err != nil {
		writeInternal(w, r, err, "accept-invite: hash failed")
		return
	}
	if err := h.Users.UpdatePasswordHash(r.Context(), u.ID, hash); err != nil {
		writeInternal(w, r, err, "accept-invite: update failed")
		return
	}
	// The invite itself is proof of mailbox ownership.
	if err := h.Users.SetEmailVerified(r.Context(), u.ID); err != nil {
		writeInternal(w, r, err, "accept-invite: set verified failed")
		return
	}
	if err := h.Users.UpdateStatus(r.Context(), u.ID, store.StatusActive); err != nil {
		writeInternal(w, r, err, "accept-invite: activate failed")
		return
	}
	_ = h.Sessions.DeleteAllForUser(r.Context(), u.ID) // defensive
	if err := h.Tokens.MarkUsed(r.Context(), tok.ID); err != nil {
		slog.Warn("accept-invite: mark used failed", "error", err, "token_id", tok.ID)
	}
	u, err = h.Users.GetByID(r.Context(), u.ID)
	if err != nil {
		writeInternal(w, r, err, "accept-invite: reload failed")
		return
	}
	if err := h.createSession(w, r, u.ID); err != nil {
		writeInternal(w, r, err, "accept-invite: session create failed")
		return
	}
	middleware.WriteJSON(w, http.StatusOK, map[string]any{"user": u})
}

// ChangePassword changes the authenticated user's password. All OTHER
// sessions are invalidated: the store has no delete-except op, so all
// sessions are deleted and a fresh one is minted for this request — the
// browser stays logged in, every other device is logged out.
func (h *Handler) ChangePassword(w http.ResponseWriter, r *http.Request) {
	u := currentUser(r)
	if u == nil {
		middleware.WriteError(w, http.StatusUnauthorized, "unauthorized", "authentication required")
		return
	}
	var req struct {
		CurrentPassword string `json:"currentPassword"`
		NewPassword     string `json:"newPassword"`
	}
	if !decodeJSON(w, r, &req) {
		return
	}
	if !h.checkNewPassword(w, r, req.NewPassword, "newPassword") {
		return
	}
	ok, _ := auth.VerifyPassword(req.CurrentPassword, u.PasswordHash)
	if !ok {
		middleware.WriteError(w, http.StatusUnauthorized, "invalid-credentials", "invalid credentials")
		return
	}
	hash, err := auth.HashPassword(req.NewPassword)
	if err != nil {
		writeInternal(w, r, err, "change-password: hash failed")
		return
	}
	if err := h.Users.UpdatePasswordHash(r.Context(), u.ID, hash); err != nil {
		writeInternal(w, r, err, "change-password: update failed")
		return
	}
	_ = h.Sessions.DeleteAllForUser(r.Context(), u.ID)
	if err := h.createSession(w, r, u.ID); err != nil {
		writeInternal(w, r, err, "change-password: session recreate failed")
		return
	}
	middleware.WriteJSON(w, http.StatusOK, map[string]string{"message": "password changed"})
}

// CSRFToken issues a fresh csrf_token cookie AND returns the same token
// in the JSON body. Login/signup are state-changing (CSRF-checked) but
// run before any session exists, so the frontend GETs this endpoint
// first and sends the value back in the X-CSRF-Token header on every
// state-changing request. The cookie is NOT HttpOnly, so same-site JS
// can read it from document.cookie — but cross-origin JS (dev apps on
// *.pages.dev, API on a trycloudflare host) cannot read another origin's
// cookie, so the body value is what the dev frontend uses. Validation
// still compares the header against the cookie the browser sends back
// automatically (SameSite=None + Secure in dev), so the double-submit
// check is unchanged.
func (h *Handler) CSRFToken(w http.ResponseWriter, r *http.Request) {
	token, err := csrf.NewToken()
	if err != nil {
		writeInternal(w, r, err, "csrf: token generation failed")
		return
	}
	csrf.SetCookie(w, token, h.Cfg)
	middleware.WriteJSON(w, http.StatusOK, map[string]string{"message": "csrf token set", "csrf_token": token})
}
