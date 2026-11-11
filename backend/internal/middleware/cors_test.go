package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/dusmamud/kumbuild/backend/internal/config"
)

func corsTestHandler() http.Handler {
	return CORS(&config.Config{AllowedOrigins: []string{
		"https://kumbuild-web.pages.dev",
		"http://localhost:3000",
	}})(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("ok"))
	}))
}

func TestCORSAllowedOrigin(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/healthz", nil)
	req.Header.Set("Origin", "https://kumbuild-web.pages.dev")
	rec := httptest.NewRecorder()
	corsTestHandler().ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("status: got %d, want 200", rec.Code)
	}
	if got := rec.Header().Get("Access-Control-Allow-Origin"); got != "https://kumbuild-web.pages.dev" {
		t.Fatalf("allow-origin: got %q", got)
	}
	if got := rec.Header().Get("Access-Control-Allow-Credentials"); got != "true" {
		t.Fatalf("allow-credentials: got %q", got)
	}
}

func TestCORSDisallowedOrigin(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/healthz", nil)
	req.Header.Set("Origin", "https://evil.example.com")
	rec := httptest.NewRecorder()
	corsTestHandler().ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("status: got %d, want 200", rec.Code)
	}
	if got := rec.Header().Get("Access-Control-Allow-Origin"); got != "" {
		t.Fatalf("allow-origin for disallowed origin: got %q", got)
	}
}

func TestCORSPreflight(t *testing.T) {
	req := httptest.NewRequest(http.MethodOptions, "/api/auth/login", nil)
	req.Header.Set("Origin", "http://localhost:3000")
	req.Header.Set("Access-Control-Request-Method", "POST")
	req.Header.Set("Access-Control-Request-Headers", "X-CSRF-Token, Content-Type")
	rec := httptest.NewRecorder()
	corsTestHandler().ServeHTTP(rec, req)
	if rec.Code != http.StatusNoContent {
		t.Fatalf("preflight status: got %d, want 204", rec.Code)
	}
	if got := rec.Header().Get("Access-Control-Allow-Origin"); got != "http://localhost:3000" {
		t.Fatalf("preflight allow-origin: got %q", got)
	}
	if got := rec.Header().Get("Access-Control-Allow-Headers"); got == "" {
		t.Fatal("preflight allow-headers missing")
	}
	if got := rec.Header().Get("Access-Control-Allow-Headers"); !containsToken(got, "X-CSRF-Token") {
		t.Fatalf("preflight allow-headers lacks X-CSRF-Token: %q", got)
	}
	if rec.Body.Len() != 0 {
		t.Fatalf("preflight body not empty: %q", rec.Body.String())
	}
}

func TestCORSNoOriginPassesThrough(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/healthz", nil)
	rec := httptest.NewRecorder()
	corsTestHandler().ServeHTTP(rec, req)
	if rec.Code != http.StatusOK || rec.Body.String() != "ok" {
		t.Fatalf("no-origin request: status=%d body=%q", rec.Code, rec.Body.String())
	}
}

func containsToken(list, tok string) bool {
	for _, p := range splitComma(list) {
		if p == tok {
			return true
		}
	}
	return false
}

func splitComma(s string) []string {
	var out []string
	cur := ""
	for _, r := range s {
		if r == ',' {
			out = append(out, trimSpace(cur))
			cur = ""
			continue
		}
		cur += string(r)
	}
	out = append(out, trimSpace(cur))
	return out
}

func trimSpace(s string) string {
	for len(s) > 0 && (s[0] == ' ' || s[0] == '\t') {
		s = s[1:]
	}
	for len(s) > 0 && (s[len(s)-1] == ' ' || s[len(s)-1] == '\t') {
		s = s[:len(s)-1]
	}
	return s
}
