package middleware

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/dusmamud/kumbuild/backend/internal/auth"
	"github.com/dusmamud/kumbuild/backend/internal/config"
	"github.com/dusmamud/kumbuild/backend/internal/csrf"
	"github.com/dusmamud/kumbuild/backend/internal/store"
	"github.com/dusmamud/kumbuild/backend/internal/testutil"
)

func setupAuth(t *testing.T) (*Authenticator, *store.User, string) {
	t.Helper()
	pool := testutil.SetupTestDB(t)
	t.Cleanup(pool.Close)
	ctx := context.Background()
	users := store.NewPGUserStore(pool)
	sessions := store.NewPGSessionStore(pool)

	u := &store.User{
		FullName: "Dus Mamud", Email: "dus@example.com", PhoneNo: "+919876543210",
		WhatsAppNo: "+919876543210", Role: store.RoleCustomer, Status: store.StatusActive,
	}
	if err := users.Create(ctx, u, "hash", nil); err != nil {
		t.Fatalf("create user: %v", err)
	}
	token, err := auth.NewSessionToken()
	if err != nil {
		t.Fatalf("token: %v", err)
	}
	s := &store.Session{
		UserID: u.ID, TokenHash: auth.HashToken(token),
		ExpiresAt: time.Now().Add(store.SessionAbsoluteTTL), LastSeenAt: time.Now(),
	}
	if err := sessions.Create(ctx, s); err != nil {
		t.Fatalf("create session: %v", err)
	}
	return &Authenticator{Users: users, Sessions: sessions}, u, token
}

func authedRequest(t *testing.T, token string) *http.Request {
	t.Helper()
	req := httptest.NewRequest(http.MethodGet, "/me", nil)
	req.AddCookie(&http.Cookie{Name: auth.SessionCookieName, Value: token})
	return req
}

func TestAuthenticateOK(t *testing.T) {
	a, u, token := setupAuth(t)
	got, err := a.Authenticate(authedRequest(t, token))
	if err != nil || got.ID != u.ID || got.Role != store.RoleCustomer {
		t.Fatalf("authenticate: %v %v", got, err)
	}
}

func TestAuthenticateNoCookie(t *testing.T) {
	a, _, _ := setupAuth(t)
	if _, err := a.Authenticate(httptest.NewRequest(http.MethodGet, "/me", nil)); err == nil {
		t.Fatal("no cookie must fail")
	}
}

func TestAuthenticateAbsoluteExpiry(t *testing.T) {
	pool := testutil.SetupTestDB(t)
	defer pool.Close()
	ctx := context.Background()
	users := store.NewPGUserStore(pool)
	sessions := store.NewPGSessionStore(pool)
	u := &store.User{FullName: "A", Email: "a@example.com", PhoneNo: "+919876543210",
		WhatsAppNo: "+919876543210", Role: store.RoleCustomer, Status: store.StatusActive}
	_ = users.Create(ctx, u, "h", nil)
	token, _ := auth.NewSessionToken()
	// Expired 8 days ago (past absolute 7d), last_seen fresh.
	_ = sessions.Create(ctx, &store.Session{UserID: u.ID, TokenHash: auth.HashToken(token),
		ExpiresAt: time.Now().Add(-24 * time.Hour), LastSeenAt: time.Now()})
	a := &Authenticator{Users: users, Sessions: sessions}
	if _, err := a.Authenticate(authedRequest(t, token)); err == nil {
		t.Fatal("absolute-expired session must fail")
	}
	// Expired session row must be deleted.
	if _, err := sessions.GetByTokenHash(ctx, auth.HashToken(token)); err == nil {
		t.Fatal("expired session row must be deleted")
	}
}

func TestAuthenticateIdleExpiry(t *testing.T) {
	pool := testutil.SetupTestDB(t)
	defer pool.Close()
	ctx := context.Background()
	users := store.NewPGUserStore(pool)
	sessions := store.NewPGSessionStore(pool)
	u := &store.User{FullName: "A", Email: "a@example.com", PhoneNo: "+919876543210",
		WhatsAppNo: "+919876543210", Role: store.RoleCustomer, Status: store.StatusActive}
	_ = users.Create(ctx, u, "h", nil)
	token, _ := auth.NewSessionToken()
	// last_seen 25h ago, absolute expiry still in the future.
	_ = sessions.Create(ctx, &store.Session{UserID: u.ID, TokenHash: auth.HashToken(token),
		ExpiresAt: time.Now().Add(6 * 24 * time.Hour), LastSeenAt: time.Now().Add(-25 * time.Hour)})
	a := &Authenticator{Users: users, Sessions: sessions}
	if _, err := a.Authenticate(authedRequest(t, token)); err == nil {
		t.Fatal("idle-expired session (25h) must fail")
	}
	if _, err := sessions.GetByTokenHash(ctx, auth.HashToken(token)); err == nil {
		t.Fatal("idle-expired session row must be deleted")
	}
}

func TestAuthenticateDisabledUser(t *testing.T) {
	pool := testutil.SetupTestDB(t)
	defer pool.Close()
	ctx := context.Background()
	users := store.NewPGUserStore(pool)
	sessions := store.NewPGSessionStore(pool)
	u := &store.User{FullName: "A", Email: "a@example.com", PhoneNo: "+919876543210",
		WhatsAppNo: "+919876543210", Role: store.RoleCustomer, Status: store.StatusActive}
	_ = users.Create(ctx, u, "h", nil)
	token, _ := auth.NewSessionToken()
	_ = sessions.Create(ctx, &store.Session{UserID: u.ID, TokenHash: auth.HashToken(token),
		ExpiresAt: time.Now().Add(7 * 24 * time.Hour), LastSeenAt: time.Now()})
	_ = users.UpdateStatus(ctx, u.ID, store.StatusDisabled)
	a := &Authenticator{Users: users, Sessions: sessions}
	if _, err := a.Authenticate(authedRequest(t, token)); err == nil {
		t.Fatal("disabled user must not authenticate (immediate logout)")
	}
}

func TestRequireAuthAndRole(t *testing.T) {
	a, _, token := setupAuth(t)
	ok := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})

	// No session -> 401 {"error":"unauthorized"}.
	rr := httptest.NewRecorder()
	RequireAuth(a)(ok).ServeHTTP(rr, httptest.NewRequest(http.MethodGet, "/x", nil))
	if rr.Code != http.StatusUnauthorized {
		t.Fatalf("unauthenticated: status %d", rr.Code)
	}
	var body map[string]string
	_ = json.NewDecoder(rr.Body).Decode(&body)
	if body["error"] != "unauthorized" {
		t.Fatalf("error envelope: %v", body)
	}

	// With session -> 200, and user in context.
	rr = httptest.NewRecorder()
	seen := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		u, ok := UserFromContext(r.Context())
		if !ok || u == nil || u.Email != "dus@example.com" {
			t.Error("user must be in context")
		}
		w.WriteHeader(http.StatusOK)
	})
	RequireAuth(a)(seen).ServeHTTP(rr, authedRequest(t, token))
	if rr.Code != http.StatusOK {
		t.Fatalf("authenticated: status %d", rr.Code)
	}

	// Customer hitting a super_admin-only route -> 403 {"error":"forbidden"}.
	rr = httptest.NewRecorder()
	RequireAuth(a)(RequireRole(store.RoleSuperAdmin)(ok)).ServeHTTP(rr, authedRequest(t, token))
	if rr.Code != http.StatusForbidden {
		t.Fatalf("wrong role: status %d", rr.Code)
	}
	_ = json.NewDecoder(rr.Body).Decode(&body)
	if body["error"] != "forbidden" {
		t.Fatalf("forbidden envelope: %v", body)
	}

	// Same role allowed -> 200.
	rr = httptest.NewRecorder()
	RequireAuth(a)(RequireRole(store.RoleCustomer, store.RoleAdmin)(ok)).ServeHTTP(rr, authedRequest(t, token))
	if rr.Code != http.StatusOK {
		t.Fatalf("allowed role: status %d", rr.Code)
	}
}

func TestRequireCSRF(t *testing.T) {
	cfg := &config.Config{Env: "dev", AllowedOrigins: []string{"https://kumbuild-web.pages.dev"}}
	ok := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(http.StatusOK) })
	h := RequireCSRF(cfg)(ok)

	// GET passes without anything.
	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, httptest.NewRequest(http.MethodGet, "/x", nil))
	if rr.Code != http.StatusOK {
		t.Fatalf("GET must skip CSRF: %d", rr.Code)
	}

	// POST with allowed Origin + matching CSRF token passes.
	token, _ := csrf.NewToken()
	req := httptest.NewRequest(http.MethodPost, "/x", nil)
	req.Header.Set("Origin", "https://kumbuild-web.pages.dev")
	req.AddCookie(&http.Cookie{Name: csrf.CookieName, Value: token})
	req.Header.Set(csrf.HeaderName, token)
	rr = httptest.NewRecorder()
	h.ServeHTTP(rr, req)
	if rr.Code != http.StatusOK {
		t.Fatalf("valid CSRF POST: %d", rr.Code)
	}

	// POST with disallowed Origin -> 403 csrf.
	req = httptest.NewRequest(http.MethodPost, "/x", nil)
	req.Header.Set("Origin", "https://evil.example.com")
	req.AddCookie(&http.Cookie{Name: csrf.CookieName, Value: token})
	req.Header.Set(csrf.HeaderName, token)
	rr = httptest.NewRecorder()
	h.ServeHTTP(rr, req)
	if rr.Code != http.StatusForbidden {
		t.Fatalf("bad origin: %d", rr.Code)
	}
	var body map[string]string
	_ = json.NewDecoder(rr.Body).Decode(&body)
	if body["error"] != "csrf" {
		t.Fatalf("csrf envelope: %v", body)
	}

	// POST with allowed Origin but mismatched CSRF token -> 403.
	req = httptest.NewRequest(http.MethodPost, "/x", nil)
	req.Header.Set("Origin", "https://kumbuild-web.pages.dev")
	req.AddCookie(&http.Cookie{Name: csrf.CookieName, Value: token})
	req.Header.Set(csrf.HeaderName, "wrong")
	rr = httptest.NewRecorder()
	h.ServeHTTP(rr, req)
	if rr.Code != http.StatusForbidden {
		t.Fatalf("mismatched token: %d", rr.Code)
	}

	// POST with no Origin at all -> 403.
	req = httptest.NewRequest(http.MethodPost, "/x", nil)
	req.AddCookie(&http.Cookie{Name: csrf.CookieName, Value: token})
	req.Header.Set(csrf.HeaderName, token)
	rr = httptest.NewRecorder()
	h.ServeHTTP(rr, req)
	if rr.Code != http.StatusForbidden {
		t.Fatalf("missing origin: %d", rr.Code)
	}

	// Referer fallback: allowed Referer (with path) passes.
	req = httptest.NewRequest(http.MethodPost, "/x", nil)
	req.Header.Set("Referer", "https://kumbuild-web.pages.dev/some/page")
	req.AddCookie(&http.Cookie{Name: csrf.CookieName, Value: token})
	req.Header.Set(csrf.HeaderName, token)
	rr = httptest.NewRecorder()
	h.ServeHTTP(rr, req)
	if rr.Code != http.StatusOK {
		t.Fatalf("allowed Referer must pass: %d", rr.Code)
	}
}

func TestWriteErrorEnvelope(t *testing.T) {
	rr := httptest.NewRecorder()
	WriteError(rr, http.StatusTeapot, "teapot", "short and stout")
	if rr.Code != http.StatusTeapot {
		t.Fatalf("status: %d", rr.Code)
	}
	var body map[string]string
	if err := json.NewDecoder(rr.Body).Decode(&body); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if body["error"] != "teapot" || body["message"] != "short and stout" {
		t.Fatalf("envelope: %v", body)
	}
	if ct := rr.Header().Get("Content-Type"); ct != "application/json" {
		t.Fatalf("content-type: %q", ct)
	}
}
