// Package csrf implements the double-submit CSRF token pattern
// (backend/README.md §6.5): the server sets a csrf_token cookie (NOT
// HttpOnly, so JS can read it) and the frontend sends the same value back
// in the X-CSRF-Token header on every state-changing request. The
// /api/auth/csrf endpoint also returns the token in its JSON body,
// because cross-origin JS (dev *.pages.dev apps calling a trycloudflare
// API host) cannot read another origin's cookie from document.cookie;
// the browser still sends the cookie back automatically, so validation
// (header == cookie) is unchanged.
package csrf

import (
	"crypto/rand"
	"crypto/subtle"
	"encoding/base64"
	"fmt"
	"net/http"

	"github.com/dusmamud/kumbuild/backend/internal/config"
)

// CookieName is the CSRF cookie name. HeaderName is the request header.
const (
	CookieName = "csrf_token"
	HeaderName = "X-CSRF-Token"
)

// NewToken returns 32 crypto-random bytes, base64.RawURLEncoding.
func NewToken() (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", fmt.Errorf("generate csrf token: %w", err)
	}
	return base64.RawURLEncoding.EncodeToString(b), nil
}

// SetCookie writes the csrf_token cookie. NOT HttpOnly (JS must read it);
// Secure always; SameSite Lax in prod, None in dev (same rule as the
// session cookie).
func SetCookie(w http.ResponseWriter, token string, cfg *config.Config) {
	sameSite := http.SameSiteNoneMode
	if cfg.IsProd() {
		sameSite = http.SameSiteLaxMode
	}
	http.SetCookie(w, &http.Cookie{
		Name:     CookieName,
		Value:    token,
		Path:     "/",
		Domain:   cfg.CookieDomain,
		HttpOnly: false,
		Secure:   true,
		SameSite: sameSite,
	})
}

// Validate is true iff the csrf_token cookie equals the X-CSRF-Token
// header, both non-empty, compared in constant time.
func Validate(r *http.Request) bool {
	cookie, err := r.Cookie(CookieName)
	if err != nil || cookie.Value == "" {
		return false
	}
	header := r.Header.Get(HeaderName)
	if header == "" {
		return false
	}
	return subtle.ConstantTimeCompare([]byte(cookie.Value), []byte(header)) == 1
}
