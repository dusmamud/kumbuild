package csrf

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/dusmamud/kumbuild/backend/internal/config"
)

func TestNewToken(t *testing.T) {
	a, err := NewToken()
	if err != nil {
		t.Fatalf("NewToken: %v", err)
	}
	b, err := NewToken()
	if err != nil {
		t.Fatalf("NewToken: %v", err)
	}
	if a == b || a == "" || len(a) != 43 {
		t.Fatalf("tokens must be unique 43-char strings: %q %q", a, b)
	}
}

func TestSetCookieAndValidate(t *testing.T) {
	cfg := &config.Config{Env: "dev"}
	token, _ := NewToken()
	rr := httptest.NewRecorder()
	SetCookie(rr, token, cfg)
	resp := rr.Result()
	cookies := resp.Cookies()
	if len(cookies) != 1 || cookies[0].Name != CookieName {
		t.Fatalf("expected one %s cookie, got %v", CookieName, cookies)
	}
	c := cookies[0]
	if c.HttpOnly {
		t.Fatal("csrf cookie must NOT be HttpOnly (JS reads it)")
	}
	if !c.Secure {
		t.Fatal("csrf cookie must be Secure")
	}
	if c.SameSite != http.SameSiteNoneMode {
		t.Fatalf("dev csrf cookie must be SameSite=None, got %v", c.SameSite)
	}

	prod := &config.Config{Env: "prod", CookieDomain: ".kumbuild.com"}
	rr = httptest.NewRecorder()
	SetCookie(rr, token, prod)
	// Go's cookie parser strips the leading dot (RFC 6265: it is ignored),
	// so the parsed Domain is "kumbuild.com".
	if got := rr.Result().Cookies()[0]; got.SameSite != http.SameSiteLaxMode || got.Domain != "kumbuild.com" {
		t.Fatalf("prod csrf cookie must be Lax + kumbuild.com: %+v", got)
	}

	// Matching cookie + header validates.
	req := httptest.NewRequest(http.MethodPost, "/x", nil)
	req.AddCookie(&http.Cookie{Name: CookieName, Value: token})
	req.Header.Set(HeaderName, token)
	if !Validate(req) {
		t.Fatal("matching cookie+header must validate")
	}
	// Mismatch fails.
	req.Header.Set(HeaderName, "wrong-token")
	if Validate(req) {
		t.Fatal("mismatched header must not validate")
	}
	// Missing header fails.
	req.Header.Del(HeaderName)
	if Validate(req) {
		t.Fatal("missing header must not validate")
	}
	// Missing cookie fails.
	req2 := httptest.NewRequest(http.MethodPost, "/x", nil)
	req2.Header.Set(HeaderName, token)
	if Validate(req2) {
		t.Fatal("missing cookie must not validate")
	}
}
