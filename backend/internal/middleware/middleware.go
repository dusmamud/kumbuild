// Package middleware holds the auth + CSRF middleware and the JSON
// response helpers shared by all handlers.
package middleware

import (
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"net/url"
	"time"

	"github.com/dusmamud/kumbuild/backend/internal/auth"
	"github.com/dusmamud/kumbuild/backend/internal/config"
	"github.com/dusmamud/kumbuild/backend/internal/csrf"
	"github.com/dusmamud/kumbuild/backend/internal/store"
)

// userContextKey is the context key for the authenticated user.
type userContextKey struct{}

// Authenticator loads a user from the session cookie on every request.
// The role is read from the DB each time — never cached in the session —
// so a role change or disable takes effect immediately.
type Authenticator struct {
	Users    store.UserStore
	Sessions store.SessionStore
}

// ErrUnauthenticated is returned when no valid session exists.
var ErrUnauthenticated = errors.New("unauthenticated")

// Authenticate reads the kb_session cookie, hashes the token, loads the
// session, enforces absolute (7d) + idle (24h) expiry, touches
// last_seen_at, and loads the user — who must be status active.
func (a *Authenticator) Authenticate(r *http.Request) (*store.User, error) {
	cookie, err := r.Cookie(auth.SessionCookieName)
	if err != nil || cookie.Value == "" {
		return nil, ErrUnauthenticated
	}
	sess, err := a.Sessions.GetByTokenHash(r.Context(), auth.HashToken(cookie.Value))
	if err != nil {
		return nil, ErrUnauthenticated
	}
	now := time.Now()
	if now.After(sess.ExpiresAt) {
		// Absolute expiry: fixed from login, never extended.
		_ = a.Sessions.Delete(r.Context(), sess.ID)
		return nil, ErrUnauthenticated
	}
	if now.After(sess.LastSeenAt.Add(store.SessionIdleTTL)) {
		// Idle expiry: 24h with no activity.
		_ = a.Sessions.Delete(r.Context(), sess.ID)
		return nil, ErrUnauthenticated
	}
	// Sliding idle clock only — absolute expiry above is untouched.
	_ = a.Sessions.TouchLastSeen(r.Context(), sess.ID)

	user, err := a.Users.GetByID(r.Context(), sess.UserID)
	if err != nil {
		return nil, ErrUnauthenticated
	}
	if user.Status != store.StatusActive {
		// pending / invited / disabled users cannot use an old session.
		return nil, ErrUnauthenticated
	}
	return user, nil
}

// WithUser stores the authenticated user in the request context.
func WithUser(ctx context.Context, u *store.User) context.Context {
	return context.WithValue(ctx, userContextKey{}, u)
}

// UserFromContext returns the authenticated user, if any.
func UserFromContext(ctx context.Context) (*store.User, bool) {
	u, ok := ctx.Value(userContextKey{}).(*store.User)
	return u, ok
}

// RequireAuth rejects requests without a valid session (401).
func RequireAuth(a *Authenticator) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			user, err := a.Authenticate(r)
			if err != nil {
				WriteError(w, http.StatusUnauthorized, "unauthorized", "authentication required")
				return
			}
			next.ServeHTTP(w, r.WithContext(WithUser(r.Context(), user)))
		})
	}
}

// RequireRole rejects authenticated users whose role is not listed (403).
// Use after RequireAuth. super_admin is NOT implicitly allowed — list it
// explicitly where it applies.
func RequireRole(roles ...string) func(http.Handler) http.Handler {
	allowed := map[string]bool{}
	for _, role := range roles {
		allowed[role] = true
	}
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			user, ok := UserFromContext(r.Context())
			if !ok || user == nil {
				WriteError(w, http.StatusUnauthorized, "unauthorized", "authentication required")
				return
			}
			if !allowed[user.Role] {
				slog.Warn("forbidden: role not allowed", "user_id", user.ID, "role", user.Role, "path", r.URL.Path)
				WriteError(w, http.StatusForbidden, "forbidden", "insufficient permissions")
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

// RequireCSRF enforces the double-submit CSRF token plus an Origin/Referer
// check on state-changing requests. Safe methods (GET/HEAD/OPTIONS) are
// skipped. A missing or non-allowed Origin on a state-changing request is
// a 403 {"error":"csrf"}.
func RequireCSRF(cfg *config.Config) func(http.Handler) http.Handler {
	allowed := map[string]bool{}
	for _, o := range cfg.AllowedOrigins {
		allowed[o] = true
	}
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			switch r.Method {
			case http.MethodGet, http.MethodHead, http.MethodOptions:
				next.ServeHTTP(w, r)
				return
			}
			origin := r.Header.Get("Origin")
			if origin == "" {
				// Referer carries a path; reduce it to scheme://host.
				if ref := r.Header.Get("Referer"); ref != "" {
					if u, err := url.Parse(ref); err == nil && u.Scheme != "" && u.Host != "" {
						origin = u.Scheme + "://" + u.Host
					}
				}
			}
			if origin == "" || !allowed[origin] {
				slog.Warn("csrf: bad origin", "origin", origin, "path", r.URL.Path)
				WriteError(w, http.StatusForbidden, "csrf", "origin not allowed")
				return
			}
			if !csrf.Validate(r) {
				WriteError(w, http.StatusForbidden, "csrf", "invalid csrf token")
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

// WriteJSON writes v as JSON with the given status.
func WriteJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

// WriteError writes the error envelope {"error": code, "message": message}.
func WriteError(w http.ResponseWriter, status int, code, message string) {
	WriteJSON(w, status, map[string]string{"error": code, "message": message})
}
