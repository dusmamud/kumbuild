package auth

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"fmt"
	"net/http"
	"time"

	"github.com/dusmamud/kumbuild/backend/internal/config"
	"github.com/dusmamud/kumbuild/backend/internal/store"
)

// SessionCookieName is the session cookie name.
const SessionCookieName = "kb_session"

// NewSessionToken returns 32 crypto-random bytes, base64.RawURLEncoding.
// The raw token goes in the cookie; only its SHA-256 hash is stored in DB.
func NewSessionToken() (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", fmt.Errorf("generate session token: %w", err)
	}
	return base64.RawURLEncoding.EncodeToString(b), nil
}

// HashToken returns the SHA-256 hex of a session/OTP/reset/invite token.
func HashToken(token string) string {
	sum := sha256.Sum256([]byte(token))
	return hex.EncodeToString(sum[:])
}

// CookieForSession builds the session cookie: HttpOnly + Secure always.
// SameSite is Lax in prod, None in dev (cross-site pages.dev -> API);
// Domain is .kumbuild.com in prod, empty in dev. 7-day MaxAge matches the
// absolute session expiry — the server enforces expiry regardless.
func CookieForSession(token string, cfg *config.Config) *http.Cookie {
	sameSite := http.SameSiteNoneMode
	if cfg.IsProd() {
		sameSite = http.SameSiteLaxMode
	}
	return &http.Cookie{
		Name:     SessionCookieName,
		Value:    token,
		Path:     "/",
		Domain:   cfg.CookieDomain,
		MaxAge:   int(7 * 24 * time.Hour / time.Second),
		Expires:  time.Now().Add(store.SessionAbsoluteTTL),
		HttpOnly: true,
		Secure:   true,
		SameSite: sameSite,
	}
}

// ClearSessionCookie expires the session cookie on the browser.
func ClearSessionCookie(cfg *config.Config) *http.Cookie {
	c := CookieForSession("", cfg)
	c.MaxAge = -1
	c.Expires = time.Unix(0, 0)
	return c
}
