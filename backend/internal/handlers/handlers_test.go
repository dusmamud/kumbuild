// Handler tests: real test DB (migrated + truncated per test) and real
// Redis, fake Turnstile and fake in-memory Mailer. No Brevo, no network
// Turnstile. Run with: go test -p 1 ./... -count=1
package handlers_test

import (
	"bytes"
	"context"
	"crypto/rand"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"regexp"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/dusmamud/kumbuild/backend/internal/auth"
	"github.com/dusmamud/kumbuild/backend/internal/config"
	"github.com/dusmamud/kumbuild/backend/internal/csrf"
	"github.com/dusmamud/kumbuild/backend/internal/mailer"
	"github.com/dusmamud/kumbuild/backend/internal/middleware"
	"github.com/dusmamud/kumbuild/backend/internal/ratelimit"
	"github.com/dusmamud/kumbuild/backend/internal/server"
	"github.com/dusmamud/kumbuild/backend/internal/store"
	"github.com/dusmamud/kumbuild/backend/internal/testutil"
	"github.com/dusmamud/kumbuild/backend/internal/turnstile"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"
)

// ------------------------------------------------------------------ fakes

type fakeTurnstile struct {
	ok  bool
	err error
}

func (f *fakeTurnstile) Verify(ctx context.Context, token, remoteIP string) (bool, error) {
	if f.err != nil {
		return false, f.err
	}
	return f.ok, nil
}

var _ turnstile.Verifier = (*fakeTurnstile)(nil)

type sentMail struct {
	To, Name, Subject, HTML, Text string
}

type fakeMailer struct {
	mu   sync.Mutex
	sent []sentMail
	fail error
}

func (m *fakeMailer) SendTransactional(ctx context.Context, to, name, subject, html, text string) error {
	if m.fail != nil {
		return m.fail
	}
	m.mu.Lock()
	defer m.mu.Unlock()
	m.sent = append(m.sent, sentMail{to, name, subject, html, text})
	return nil
}

func (m *fakeMailer) SendPromotional(ctx context.Context, to, name, subject, html, text string, optedIn bool) error {
	return m.SendTransactional(ctx, to, name, subject, html, text)
}

var _ mailer.Mailer = (*fakeMailer)(nil)

func (m *fakeMailer) mails() []sentMail {
	m.mu.Lock()
	defer m.mu.Unlock()
	out := make([]sentMail, len(m.sent))
	copy(out, m.sent)
	return out
}

var otpRe = regexp.MustCompile(`\b(\d{6})\b`)
var tokenRe = regexp.MustCompile(`token=([A-Za-z0-9_-]+)`)

// lastOTP extracts the 6-digit code from the most recent mail.
func (m *fakeMailer) lastOTP(t *testing.T) string {
	t.Helper()
	mails := m.mails()
	if len(mails) == 0 {
		t.Fatal("no mail captured")
	}
	mt := otpRe.FindStringSubmatch(mails[len(mails)-1].HTML)
	if mt == nil {
		t.Fatalf("no OTP in last mail: %q", mails[len(mails)-1].HTML)
	}
	return mt[1]
}

// lastToken extracts the token= query value from the most recent mail.
func (m *fakeMailer) lastToken(t *testing.T) string {
	t.Helper()
	mails := m.mails()
	if len(mails) == 0 {
		t.Fatal("no mail captured")
	}
	mt := tokenRe.FindStringSubmatch(mails[len(mails)-1].HTML)
	if mt == nil {
		t.Fatalf("no token in last mail: %q", mails[len(mails)-1].HTML)
	}
	return mt[1]
}

// ------------------------------------------------------------------ env

type testEnv struct {
	t         *testing.T
	pool      *pgxpool.Pool
	handler   http.Handler
	rdb       *redis.Client
	mailer    *fakeMailer
	turnstile *fakeTurnstile
	users     store.UserStore
	billing   store.BillingStore
	sessions  store.SessionStore
	tokens    store.TokenStore
	audit     store.AuditStore
	seq       int
}

func newTestEnv(t *testing.T) *testEnv {
	t.Helper()
	pool := testutil.SetupTestDB(t)
	t.Cleanup(pool.Close)
	rdb := redis.NewClient(&redis.Options{
		Addr: "127.0.0.1:6379", Password: "testpass123", DB: 0,
	})
	if err := rdb.Ping(context.Background()).Err(); err != nil {
		t.Skipf("redis unreachable: %v", err)
	}
	t.Cleanup(func() { _ = rdb.Close() })

	cfg := &config.Config{
		Env: "dev", Port: 8080, AppBaseURL: "http://localhost:8080",
		AllowedOrigins: append([]string(nil), config.DefaultAllowedOrigins...),
	}
	users := store.NewPGUserStore(pool)
	sessions := store.NewPGSessionStore(pool)
	fm := &fakeMailer{}
	ft := &fakeTurnstile{ok: true}
	authn := &middleware.Authenticator{Users: users, Sessions: sessions}
	h := server.New(server.Deps{
		Cfg: cfg, Pool: pool, Redis: rdb,
		Users: users, Billing: users, Sessions: sessions,
		Tokens: store.NewPGTokenStore(pool),
		Audit:  store.NewPGAuditStore(pool),
		Notes:  store.NewPGNoteStore(pool),
		Outbox: store.NewPGOutboxStore(pool),
		Mailer: fm, Turnstile: ft,
		Limiter: ratelimit.NewWithClient(rdb), Auth: authn,
	})
	return &testEnv{
		t: t, pool: pool, handler: h, rdb: rdb, mailer: fm, turnstile: ft,
		users: users, billing: users, sessions: sessions,
		tokens: store.NewPGTokenStore(pool), audit: store.NewPGAuditStore(pool),
	}
}

// uniqueEmail returns a fresh email per call (rate limits + unique
// constraints never collide between tests).
func (e *testEnv) uniqueEmail() string {
	e.seq++
	name := strings.ReplaceAll(e.t.Name(), "/", "-")
	return fmt.Sprintf("u%d-%s-%s@example.com", e.seq, name, procSuffix)
}

// procSuffix makes emails unique per test PROCESS (not just per test):
// Redis rate-limit counters live 60s, so a second `go test` run within a
// minute would otherwise reuse the same per-email keys and 429.
var procSuffix = func() string {
	var b [3]byte
	if _, err := rand.Read(b[:]); err != nil {
		return fmt.Sprintf("%x", time.Now().UnixNano()&0xffffff)
	}
	return fmt.Sprintf("%x", b)
}()

// globalIPCounter makes uniqueIP() unique across ALL tests in this
// package: each test env restarts its own counters, but Redis rate-limit
// keys live 60s, so per-test IP sequences would collide and 429. Seeded
// per process for the same reason as procSuffix.
var globalIPCounter atomic.Int32

func init() {
	globalIPCounter.Store(int32(time.Now().UnixNano() % 1000000))
}

// uniqueIP returns a fresh IP per call (per-IP rate limits never collide).
func (e *testEnv) uniqueIP() string {
	n := int(globalIPCounter.Add(1))
	return fmt.Sprintf("10.%d.%d.%d", 20+(n>>16)%10, (n>>8)%255+1, n%255+1)
}

// testPassword returns a policy-valid password, unique per call so HIBP
// (if reachable) never sees a known-breached password.
func (e *testEnv) testPassword() string {
	e.seq++
	return fmt.Sprintf("Kumb!2026-%04d", e.seq)
}

type reqOptions struct {
	cookies []*http.Cookie
	csrf    bool // set allowed Origin + csrf cookie/header
	ip      string
}

// do sends one request through the full router (CSRF + auth middleware
// included) and returns the recorder.
func (e *testEnv) do(t *testing.T, method, path string, body any, o reqOptions) *httptest.ResponseRecorder {
	t.Helper()
	var rd *bytes.Reader
	if body != nil {
		b, err := json.Marshal(body)
		if err != nil {
			t.Fatalf("marshal body: %v", err)
		}
		rd = bytes.NewReader(b)
	} else {
		rd = bytes.NewReader(nil)
	}
	req := httptest.NewRequest(method, path, rd)
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	if o.ip != "" {
		req.Header.Set("X-Forwarded-For", o.ip)
	}
	if o.csrf {
		token, err := csrf.NewToken()
		if err != nil {
			t.Fatalf("csrf token: %v", err)
		}
		req.Header.Set("Origin", config.DefaultAllowedOrigins[0])
		req.AddCookie(&http.Cookie{Name: csrf.CookieName, Value: token})
		req.Header.Set(csrf.HeaderName, token)
	}
	for _, c := range o.cookies {
		req.AddCookie(c)
	}
	rr := httptest.NewRecorder()
	e.handler.ServeHTTP(rr, req)
	return rr
}

type errBody struct {
	Error   string            `json:"error"`
	Message string            `json:"message"`
	Fields  map[string]string `json:"fields"`
}

func decodeErr(t *testing.T, rr *httptest.ResponseRecorder) errBody {
	t.Helper()
	var b errBody
	if err := json.Unmarshal(rr.Body.Bytes(), &b); err != nil {
		t.Fatalf("decode error body (%d): %v — body: %s", rr.Code, err, rr.Body.String())
	}
	return b
}

func mustStatus(t *testing.T, rr *httptest.ResponseRecorder, want int) {
	t.Helper()
	if rr.Code != want {
		t.Fatalf("status: got %d, want %d — body: %s", rr.Code, want, rr.Body.String())
	}
}

func mustErrCode(t *testing.T, rr *httptest.ResponseRecorder, status int, code string) {
	t.Helper()
	mustStatus(t, rr, status)
	if got := decodeErr(t, rr).Error; got != code {
		t.Fatalf("error code: got %q, want %q — body: %s", got, code, rr.Body.String())
	}
}

func decodeUser(t *testing.T, rr *httptest.ResponseRecorder) store.User {
	t.Helper()
	var resp struct {
		User store.User `json:"user"`
	}
	if err := json.Unmarshal(rr.Body.Bytes(), &resp); err != nil {
		t.Fatalf("decode user (%d): %v — body: %s", rr.Code, err, rr.Body.String())
	}
	return resp.User
}

func sessionCookie(rr *httptest.ResponseRecorder) *http.Cookie {
	for _, c := range rr.Result().Cookies() {
		if c.Name == auth.SessionCookieName {
			return c
		}
	}
	return nil
}

// signupBody builds a valid customer signup body. Signup collects NO
// billing address (removed 2026-11-12), so none is sent.
func signupBody(email, password string) map[string]any {
	return map[string]any{
		"full_name": "Test Customer", "email": email, "password": password,
		"phone_no": "+919876543210", "whatsapp_no": "+919876543210",
		"turnstile_token": "test-token",
	}
}

// signupViaAPI signs up a customer and returns the new user + session cookie.
func (e *testEnv) signupViaAPI(t *testing.T, email string) (store.User, *http.Cookie) {
	t.Helper()
	rr := e.do(t, "POST", "/api/auth/signup", signupBody(email, e.testPassword()),
		reqOptions{csrf: true, ip: e.uniqueIP()})
	mustStatus(t, rr, http.StatusCreated)
	u := decodeUser(t, rr)
	c := sessionCookie(rr)
	if c == nil {
		t.Fatal("signup did not set a session cookie")
	}
	return u, c
}

// verifyViaAPI verifies the OTP found in the last captured mail.
func (e *testEnv) verifyViaAPI(t *testing.T, email string, cookies []*http.Cookie) store.User {
	t.Helper()
	code := e.mailer.lastOTP(t)
	rr := e.do(t, "POST", "/api/auth/verify-email",
		map[string]any{"email": email, "code": code},
		reqOptions{csrf: true, ip: e.uniqueIP(), cookies: cookies})
	mustStatus(t, rr, http.StatusOK)
	return decodeUser(t, rr)
}

// activeCustomer signs up + verifies, returning user + session cookie.
func (e *testEnv) activeCustomer(t *testing.T) (store.User, *http.Cookie) {
	t.Helper()
	email := e.uniqueEmail()
	u, c := e.signupViaAPI(t, email)
	e.verifyViaAPI(t, email, []*http.Cookie{c})
	return u, c
}

// loginViaAPI logs in and returns the session cookie.
func (e *testEnv) loginViaAPI(t *testing.T, email, password string) *http.Cookie {
	t.Helper()
	rr := e.do(t, "POST", "/api/auth/login",
		map[string]any{"email": email, "password": password, "turnstile_token": "test-token"},
		reqOptions{csrf: true, ip: e.uniqueIP()})
	mustStatus(t, rr, http.StatusOK)
	c := sessionCookie(rr)
	if c == nil {
		t.Fatal("login did not set a session cookie")
	}
	return c
}

// createUserDB creates a user directly in the DB (setup for admin tests).
func (e *testEnv) createUserDB(t *testing.T, role, status string) *store.User {
	t.Helper()
	hash, err := auth.HashPassword(e.testPassword())
	if err != nil {
		t.Fatalf("hash: %v", err)
	}
	u := &store.User{
		FullName: "Test User", Email: e.uniqueEmail(),
		PhoneNo: "+919876543210", WhatsAppNo: "+919876543210",
		Role: role, Status: status,
	}
	if err := e.users.Create(context.Background(), u, hash, nil); err != nil {
		t.Fatalf("create user: %v", err)
	}
	return u
}

// sessionCookieDB mints a session row for u and returns its cookie.
func (e *testEnv) sessionCookieDB(t *testing.T, u *store.User) *http.Cookie {
	t.Helper()
	token, err := auth.NewSessionToken()
	if err != nil {
		t.Fatal(err)
	}
	now := time.Now()
	if err := e.sessions.Create(context.Background(), &store.Session{
		UserID: u.ID, TokenHash: auth.HashToken(token),
		ExpiresAt: now.Add(store.SessionAbsoluteTTL), LastSeenAt: now,
	}); err != nil {
		t.Fatalf("create session: %v", err)
	}
	return &http.Cookie{Name: auth.SessionCookieName, Value: token}
}

// adminCreateBody builds a valid POST /admin/users body.
func adminCreateBody(email, password, role string) map[string]any {
	b := map[string]any{
		"full_name": "New Person", "email": email,
		"phone_no": "+919876543210", "whatsapp_no": "+919876543210",
		"role": role,
	}
	if password != "" {
		b["password"] = password
	}
	if role == "customer" || role == "" {
		b["billing_name"] = "New Person"
		b["address_line1"] = "2 Test Road"
		b["city"] = "Pune"
		b["state"] = "Maharashtra"
		b["pincode"] = "411001"
	}
	return b
}

// ------------------------------------------------------------------- probes

func TestHealthzReadyz(t *testing.T) {
	e := newTestEnv(t)
	rr := e.do(t, "GET", "/healthz", nil, reqOptions{})
	mustStatus(t, rr, http.StatusOK)
	var h map[string]string
	_ = json.Unmarshal(rr.Body.Bytes(), &h)
	if h["status"] != "ok" {
		t.Fatalf("healthz: %v", h)
	}

	rr = e.do(t, "GET", "/readyz", nil, reqOptions{})
	mustStatus(t, rr, http.StatusOK)
	_ = json.Unmarshal(rr.Body.Bytes(), &h)
	if h["status"] != "ready" {
		t.Fatalf("readyz: %v", h)
	}
}

func TestCSRFEndpoint(t *testing.T) {
	e := newTestEnv(t)
	rr := e.do(t, "GET", "/api/auth/csrf", nil, reqOptions{})
	mustStatus(t, rr, http.StatusOK)
	var cookieVal string
	for _, c := range rr.Result().Cookies() {
		if c.Name == csrf.CookieName && c.Value != "" {
			cookieVal = c.Value
		}
	}
	if cookieVal == "" {
		t.Fatal("GET /api/auth/csrf did not set a csrf_token cookie")
	}
	// The same token must also come back in the JSON body, so
	// cross-origin JS (which cannot read the cookie) can send the
	// X-CSRF-Token header.
	var body map[string]string
	if err := json.Unmarshal(rr.Body.Bytes(), &body); err != nil {
		t.Fatalf("csrf body is not JSON: %v", err)
	}
	if body["csrf_token"] != cookieVal {
		t.Fatalf("csrf body token %q does not match cookie %q", body["csrf_token"], cookieVal)
	}
}

// ------------------------------------------------------------------- signup

func TestSignupHappyPath(t *testing.T) {
	e := newTestEnv(t)
	email := e.uniqueEmail()
	rr := e.do(t, "POST", "/api/auth/signup", signupBody(email, e.testPassword()),
		reqOptions{csrf: true, ip: e.uniqueIP()})
	mustStatus(t, rr, http.StatusCreated)
	u := decodeUser(t, rr)
	if u.Email != email || u.Role != store.RoleCustomer || u.Status != store.StatusPending {
		t.Fatalf("user: %+v", u)
	}
	if u.PasswordHash != "" {
		t.Fatal("password hash leaked in response")
	}
	if sessionCookie(rr) == nil {
		t.Fatal("no session cookie on signup")
	}
	mails := e.mailer.mails()
	if len(mails) != 1 || mails[0].To != email {
		t.Fatalf("expected 1 OTP mail to %s, got %+v", email, mails)
	}
	// Signup stores NO billing address.
	if _, err := e.billing.GetByUserID(context.Background(), u.ID); err == nil {
		t.Fatal("signup must not store a billing address")
	}
}

func TestSignupNormalizesPhonesAndIgnoresBilling(t *testing.T) {
	e := newTestEnv(t)
	email := e.uniqueEmail()
	b := signupBody(email, e.testPassword())
	// Messy typed phone forms must be normalised to E.164 for storage.
	b["phone_no"] = "098765 43210"
	b["whatsapp_no"] = "+91 98765 43210"
	// Stray billing fields — even INVALID ones — are ignored at signup:
	// not validated, not stored.
	b["billing_name"] = "Ignored Person"
	b["address_line1"] = "9 Nowhere Lane"
	b["city"] = "Nowhere"
	b["state"] = "Noland"
	b["pincode"] = "123" // would be invalid-pincode if billing were validated
	rr := e.do(t, "POST", "/api/auth/signup", b, reqOptions{csrf: true, ip: e.uniqueIP()})
	mustStatus(t, rr, http.StatusCreated)
	u := decodeUser(t, rr)
	if u.PhoneNo != "+919876543210" || u.WhatsAppNo != "+919876543210" {
		t.Fatalf("phones not normalised: %+v", u)
	}
	if _, err := e.billing.GetByUserID(context.Background(), u.ID); err == nil {
		t.Fatal("signup must not store a billing address")
	}
}

func TestSignupValidationErrors(t *testing.T) {
	e := newTestEnv(t)
	// Missing email.
	b := signupBody("", e.testPassword())
	rr := e.do(t, "POST", "/api/auth/signup", b, reqOptions{csrf: true, ip: e.uniqueIP()})
	mustErrCode(t, rr, http.StatusBadRequest, "validation-failed")
	if decodeErr(t, rr).Fields["email"] == "" {
		t.Fatalf("expected email field error: %s", rr.Body.String())
	}
	// Bad phone (billing fields are NOT part of signup validation
	// anymore; the phone validator is the format gate here).
	b = signupBody(e.uniqueEmail(), e.testPassword())
	b["phone_no"] = "12345"
	rr = e.do(t, "POST", "/api/auth/signup", b, reqOptions{csrf: true, ip: e.uniqueIP()})
	mustErrCode(t, rr, http.StatusBadRequest, "validation-failed")
	if decodeErr(t, rr).Fields["phone_no"] != "invalid-phone" {
		t.Fatalf("expected invalid-phone: %s", rr.Body.String())
	}
	// Weak password.
	b = signupBody(e.uniqueEmail(), "weak")
	rr = e.do(t, "POST", "/api/auth/signup", b, reqOptions{csrf: true, ip: e.uniqueIP()})
	mustErrCode(t, rr, http.StatusBadRequest, "validation-failed")
	if decodeErr(t, rr).Fields["password"] != "weak-password" {
		t.Fatalf("expected weak-password: %s", rr.Body.String())
	}
	// No billing fields at all: signup must NOT fail on billing
	// (billing is not collected at signup anymore).
	b = signupBody(e.uniqueEmail(), e.testPassword())
	rr = e.do(t, "POST", "/api/auth/signup", b, reqOptions{csrf: true, ip: e.uniqueIP()})
	mustStatus(t, rr, http.StatusCreated)
}

func TestSignupDuplicateEmail409(t *testing.T) {
	e := newTestEnv(t)
	email := e.uniqueEmail()
	pw := e.testPassword()
	rr := e.do(t, "POST", "/api/auth/signup", signupBody(email, pw), reqOptions{csrf: true, ip: e.uniqueIP()})
	mustStatus(t, rr, http.StatusCreated)
	rr = e.do(t, "POST", "/api/auth/signup", signupBody(email, pw), reqOptions{csrf: true, ip: e.uniqueIP()})
	mustErrCode(t, rr, http.StatusConflict, "exists")
}

func TestSignupBadJSON(t *testing.T) {
	e := newTestEnv(t)
	req := httptest.NewRequest("POST", "/api/auth/signup", strings.NewReader("{not json"))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Origin", config.DefaultAllowedOrigins[0])
	token, _ := csrf.NewToken()
	req.AddCookie(&http.Cookie{Name: csrf.CookieName, Value: token})
	req.Header.Set(csrf.HeaderName, token)
	req.Header.Set("X-Forwarded-For", e.uniqueIP())
	rr := httptest.NewRecorder()
	e.handler.ServeHTTP(rr, req)
	mustErrCode(t, rr, http.StatusBadRequest, "invalid-json")
}

func TestSignupMailFailure500(t *testing.T) {
	e := newTestEnv(t)
	e.mailer.fail = fmt.Errorf("brevo down")
	email := e.uniqueEmail()
	rr := e.do(t, "POST", "/api/auth/signup", signupBody(email, e.testPassword()),
		reqOptions{csrf: true, ip: e.uniqueIP()})
	mustErrCode(t, rr, http.StatusInternalServerError, "email-failed")
	// User row stays (resend-otp can be used later).
	u, err := e.users.GetByEmail(context.Background(), email)
	if err != nil || u.Status != store.StatusPending {
		t.Fatalf("user row must stay after mail failure: %v %+v", err, u)
	}
}

// ---------------------------------------------------------------- verify-email

func TestVerifyEmailHappyPath(t *testing.T) {
	e := newTestEnv(t)
	email := e.uniqueEmail()
	u, c := e.signupViaAPI(t, email)
	// Signup session is kept: verify with the signup cookie.
	verified := e.verifyViaAPI(t, email, []*http.Cookie{c})
	if verified.ID != u.ID || verified.Status != store.StatusActive {
		t.Fatalf("verified user: %+v", verified)
	}
	if verified.EmailVerifiedAt == nil {
		t.Fatal("email_verified_at must be set")
	}
	// The kept signup session now works (user is active).
	rr := e.do(t, "GET", "/api/auth/me", nil, reqOptions{cookies: []*http.Cookie{c}})
	mustStatus(t, rr, http.StatusOK)
	// Same code again -> used already.
	rr = e.do(t, "POST", "/api/auth/verify-email",
		map[string]any{"email": email, "code": e.mailer.lastOTP(t)},
		reqOptions{csrf: true, ip: e.uniqueIP()})
	mustErrCode(t, rr, http.StatusBadRequest, "invalid-code")
}

func TestVerifyEmailWrongCode(t *testing.T) {
	e := newTestEnv(t)
	email := e.uniqueEmail()
	_, _ = e.signupViaAPI(t, email)
	real := e.mailer.lastOTP(t)
	wrong := "000000"
	if wrong == real {
		wrong = "000001"
	}
	rr := e.do(t, "POST", "/api/auth/verify-email",
		map[string]any{"email": email, "code": wrong},
		reqOptions{csrf: true, ip: e.uniqueIP()})
	mustErrCode(t, rr, http.StatusBadRequest, "invalid-code")
	// Unknown email: same code/message (no enumeration).
	rr = e.do(t, "POST", "/api/auth/verify-email",
		map[string]any{"email": "nobody@example.com", "code": "123456"},
		reqOptions{csrf: true, ip: e.uniqueIP()})
	mustErrCode(t, rr, http.StatusBadRequest, "invalid-code")
}

func TestVerifyEmailTooManyAttempts(t *testing.T) {
	e := newTestEnv(t)
	email := e.uniqueEmail()
	_, _ = e.signupViaAPI(t, email)
	real := e.mailer.lastOTP(t)
	wrong := "000000"
	if wrong == real {
		wrong = "000001"
	}
	for i := 0; i < 5; i++ {
		rr := e.do(t, "POST", "/api/auth/verify-email",
			map[string]any{"email": email, "code": wrong},
			reqOptions{csrf: true, ip: e.uniqueIP()})
		mustErrCode(t, rr, http.StatusBadRequest, "invalid-code")
	}
	rr := e.do(t, "POST", "/api/auth/verify-email",
		map[string]any{"email": email, "code": wrong},
		reqOptions{csrf: true, ip: e.uniqueIP()})
	mustErrCode(t, rr, http.StatusTooManyRequests, "too-many-attempts")
	// The token was invalidated at the store level: the correct code no
	// longer resolves to a valid token.
	if _, err := e.tokens.GetValidByHash(context.Background(), store.TokenKindOTP, auth.HashOTP(real)); err == nil {
		t.Fatal("OTP token must be invalidated after too many attempts")
	}
	// And the endpoint stays blocked while the counter window lasts.
	rr = e.do(t, "POST", "/api/auth/verify-email",
		map[string]any{"email": email, "code": real},
		reqOptions{csrf: true, ip: e.uniqueIP()})
	mustErrCode(t, rr, http.StatusTooManyRequests, "too-many-attempts")
}

func TestResendOTP(t *testing.T) {
	e := newTestEnv(t)
	email := e.uniqueEmail()
	_, _ = e.signupViaAPI(t, email)
	oldCode := e.mailer.lastOTP(t)
	rr := e.do(t, "POST", "/api/auth/resend-otp",
		map[string]any{"email": email}, reqOptions{csrf: true, ip: e.uniqueIP()})
	mustStatus(t, rr, http.StatusOK)
	newCode := e.mailer.lastOTP(t)
	if newCode == oldCode {
		t.Fatal("resend-otp must issue a new code")
	}
	// Old code is dead.
	rr = e.do(t, "POST", "/api/auth/verify-email",
		map[string]any{"email": email, "code": oldCode},
		reqOptions{csrf: true, ip: e.uniqueIP()})
	mustErrCode(t, rr, http.StatusBadRequest, "invalid-code")
	// New code works.
	rr = e.do(t, "POST", "/api/auth/verify-email",
		map[string]any{"email": email, "code": newCode},
		reqOptions{csrf: true, ip: e.uniqueIP()})
	mustStatus(t, rr, http.StatusOK)
	// Unknown email: same generic 200.
	rr = e.do(t, "POST", "/api/auth/resend-otp",
		map[string]any{"email": "nobody@example.com"}, reqOptions{csrf: true, ip: e.uniqueIP()})
	mustStatus(t, rr, http.StatusOK)
}

// ------------------------------------------------------------------- login

func TestLoginHappyPath(t *testing.T) {
	e := newTestEnv(t)
	email := e.uniqueEmail()
	pw := e.testPassword()
	rr := e.do(t, "POST", "/api/auth/signup", signupBody(email, pw), reqOptions{csrf: true, ip: e.uniqueIP()})
	mustStatus(t, rr, http.StatusCreated)
	c := sessionCookie(rr)
	e.verifyViaAPI(t, email, []*http.Cookie{c})
	rr = e.do(t, "POST", "/api/auth/login",
		map[string]any{"email": email, "password": pw, "turnstile_token": "test-token"},
		reqOptions{csrf: true, ip: e.uniqueIP()})
	mustStatus(t, rr, http.StatusOK)
	u := decodeUser(t, rr)
	if u.Role != store.RoleCustomer {
		t.Fatalf("login user role: %s", u.Role)
	}
	if sessionCookie(rr) == nil {
		t.Fatal("login did not set a session cookie")
	}
	var csrfSet bool
	for _, ck := range rr.Result().Cookies() {
		if ck.Name == csrf.CookieName && ck.Value != "" {
			csrfSet = true
		}
	}
	if !csrfSet {
		t.Fatal("login did not set a csrf cookie")
	}
}

func TestLoginWrongPasswordAndUnknown(t *testing.T) {
	e := newTestEnv(t)
	email := e.uniqueEmail()
	pw := e.testPassword()
	rr := e.do(t, "POST", "/api/auth/signup", signupBody(email, pw), reqOptions{csrf: true, ip: e.uniqueIP()})
	mustStatus(t, rr, http.StatusCreated)
	e.verifyViaAPI(t, email, []*http.Cookie{sessionCookie(rr)})
	// Wrong password.
	rr = e.do(t, "POST", "/api/auth/login",
		map[string]any{"email": email, "password": "Wrong!Pass9", "turnstile_token": "test-token"},
		reqOptions{csrf: true, ip: e.uniqueIP()})
	mustErrCode(t, rr, http.StatusUnauthorized, "invalid-credentials")
	if got := decodeErr(t, rr).Message; got != "invalid credentials" {
		t.Fatalf("message: %q", got)
	}
	// Unknown email: identical code/message.
	rr = e.do(t, "POST", "/api/auth/login",
		map[string]any{"email": "nobody@example.com", "password": "Wrong!Pass9", "turnstile_token": "test-token"},
		reqOptions{csrf: true, ip: e.uniqueIP()})
	mustErrCode(t, rr, http.StatusUnauthorized, "invalid-credentials")
}

func TestLoginPendingUser401(t *testing.T) {
	e := newTestEnv(t)
	email := e.uniqueEmail()
	pw := e.testPassword()
	rr := e.do(t, "POST", "/api/auth/signup", signupBody(email, pw), reqOptions{csrf: true, ip: e.uniqueIP()})
	mustStatus(t, rr, http.StatusCreated)
	// Never verified: login must fail even with the right password.
	rr = e.do(t, "POST", "/api/auth/login",
		map[string]any{"email": email, "password": pw, "turnstile_token": "test-token"},
		reqOptions{csrf: true, ip: e.uniqueIP()})
	mustErrCode(t, rr, http.StatusUnauthorized, "invalid-credentials")
}

func TestLoginRateLimited(t *testing.T) {
	e := newTestEnv(t)
	email := e.uniqueEmail()
	pw := e.testPassword()
	rr := e.do(t, "POST", "/api/auth/signup", signupBody(email, pw), reqOptions{csrf: true, ip: e.uniqueIP()})
	mustStatus(t, rr, http.StatusCreated)
	e.verifyViaAPI(t, email, []*http.Cookie{sessionCookie(rr)})
	ip := e.uniqueIP()
	for i := 0; i < 5; i++ {
		rr = e.do(t, "POST", "/api/auth/login",
			map[string]any{"email": email, "password": "Wrong!Pass9", "turnstile_token": "test-token"},
			reqOptions{csrf: true, ip: ip})
		mustStatus(t, rr, http.StatusUnauthorized)
	}
	rr = e.do(t, "POST", "/api/auth/login",
		map[string]any{"email": email, "password": pw, "turnstile_token": "test-token"},
		reqOptions{csrf: true, ip: ip})
	mustErrCode(t, rr, http.StatusTooManyRequests, "rate-limited")
}

func TestLogoutClearsSession(t *testing.T) {
	e := newTestEnv(t)
	email := e.uniqueEmail()
	pw := e.testPassword()
	rr := e.do(t, "POST", "/api/auth/signup", signupBody(email, pw), reqOptions{csrf: true, ip: e.uniqueIP()})
	mustStatus(t, rr, http.StatusCreated)
	e.verifyViaAPI(t, email, []*http.Cookie{sessionCookie(rr)})
	c := e.loginViaAPI(t, email, pw)
	rr = e.do(t, "POST", "/api/auth/logout", nil, reqOptions{csrf: true, ip: e.uniqueIP(), cookies: []*http.Cookie{c}})
	mustStatus(t, rr, http.StatusOK)
	// Session row gone.
	if _, err := e.sessions.GetByTokenHash(context.Background(), auth.HashToken(c.Value)); err == nil {
		t.Fatal("session row must be deleted on logout")
	}
	// A cleared session cookie is sent back.
	var cleared bool
	for _, ck := range rr.Result().Cookies() {
		if ck.Name == auth.SessionCookieName && ck.MaxAge < 0 {
			cleared = true
		}
	}
	if !cleared {
		t.Fatal("logout did not clear the session cookie")
	}
	// Old cookie no longer authenticates.
	rr = e.do(t, "GET", "/api/auth/me", nil, reqOptions{cookies: []*http.Cookie{c}})
	mustStatus(t, rr, http.StatusUnauthorized)
}

func TestMeUnauthorized(t *testing.T) {
	e := newTestEnv(t)
	rr := e.do(t, "GET", "/api/auth/me", nil, reqOptions{})
	mustErrCode(t, rr, http.StatusUnauthorized, "unauthorized")
}

func TestMeIncludesBilling(t *testing.T) {
	e := newTestEnv(t)
	u, c := e.activeCustomer(t)
	// Signup no longer collects billing, so seed the address the way
	// it arrives now (admin/profile capture) — directly via the store.
	if err := e.billing.Upsert(context.Background(), &store.BillingAddress{
		UserID: u.ID, BillingName: "Test Customer", AddressLine1: "1 Test Street",
		City: "Mumbai", State: "Maharashtra", Pincode: "400001", Country: "India",
	}); err != nil {
		t.Fatalf("seed billing: %v", err)
	}
	rr := e.do(t, "GET", "/api/auth/me", nil, reqOptions{cookies: []*http.Cookie{c}})
	mustStatus(t, rr, http.StatusOK)
	var resp struct {
		User           store.User            `json:"user"`
		BillingAddress *store.BillingAddress `json:"billing_address"`
	}
	if err := json.Unmarshal(rr.Body.Bytes(), &resp); err != nil {
		t.Fatalf("decode me: %v", err)
	}
	if resp.BillingAddress == nil || resp.BillingAddress.Pincode != "400001" {
		t.Fatalf("billing_address: %+v", resp.BillingAddress)
	}
}

// ------------------------------------------------------------------- forgot / reset

func TestForgotPasswordAlways200(t *testing.T) {
	e := newTestEnv(t)
	// Unknown email: 200, no mail.
	rr := e.do(t, "POST", "/api/auth/forgot-password",
		map[string]any{"email": "nobody@example.com", "turnstile_token": "test-token"},
		reqOptions{csrf: true, ip: e.uniqueIP()})
	mustStatus(t, rr, http.StatusOK)
	if len(e.mailer.mails()) != 0 {
		t.Fatal("no mail must be sent for an unknown email")
	}
	// Real user: 200 + reset mail with link.
	u, _ := e.activeCustomer(t)
	before := len(e.mailer.mails())
	rr = e.do(t, "POST", "/api/auth/forgot-password",
		map[string]any{"email": u.Email, "turnstile_token": "test-token"},
		reqOptions{csrf: true, ip: e.uniqueIP()})
	mustStatus(t, rr, http.StatusOK)
	mails := e.mailer.mails()
	if len(mails) != before+1 {
		t.Fatalf("expected a reset mail, got %d mails", len(mails))
	}
	if !strings.Contains(mails[len(mails)-1].HTML, "/reset-password?token=") {
		t.Fatalf("reset mail has no link: %q", mails[len(mails)-1].HTML)
	}
	// Disabled user: 200, no mail.
	_ = e.users.UpdateStatus(context.Background(), u.ID, store.StatusDisabled)
	before = len(e.mailer.mails())
	rr = e.do(t, "POST", "/api/auth/forgot-password",
		map[string]any{"email": u.Email, "turnstile_token": "test-token"},
		reqOptions{csrf: true, ip: e.uniqueIP()})
	mustStatus(t, rr, http.StatusOK)
	if len(e.mailer.mails()) != before {
		t.Fatal("no mail must be sent for a disabled user")
	}
}

func TestResetPasswordHappyPath(t *testing.T) {
	e := newTestEnv(t)
	email := e.uniqueEmail()
	pw := e.testPassword()
	rr := e.do(t, "POST", "/api/auth/signup", signupBody(email, pw), reqOptions{csrf: true, ip: e.uniqueIP()})
	mustStatus(t, rr, http.StatusCreated)
	e.verifyViaAPI(t, email, []*http.Cookie{sessionCookie(rr)})
	oldSession := e.loginViaAPI(t, email, pw)
	rr = e.do(t, "POST", "/api/auth/forgot-password",
		map[string]any{"email": email, "turnstile_token": "test-token"},
		reqOptions{csrf: true, ip: e.uniqueIP()})
	mustStatus(t, rr, http.StatusOK)
	token := e.mailer.lastToken(t)
	newPW := e.testPassword()
	rr = e.do(t, "POST", "/api/auth/reset-password",
		map[string]any{"token": token, "newPassword": newPW, "turnstile_token": "test-token"},
		reqOptions{csrf: true, ip: e.uniqueIP()})
	mustStatus(t, rr, http.StatusOK)
	// Old session is dead (all sessions invalidated).
	rr = e.do(t, "GET", "/api/auth/me", nil, reqOptions{cookies: []*http.Cookie{oldSession}})
	mustStatus(t, rr, http.StatusUnauthorized)
	// New password works, old one doesn't.
	c := e.loginViaAPI(t, email, newPW)
	rr = e.do(t, "GET", "/api/auth/me", nil, reqOptions{cookies: []*http.Cookie{c}})
	mustStatus(t, rr, http.StatusOK)
	rr = e.do(t, "POST", "/api/auth/login",
		map[string]any{"email": email, "password": pw, "turnstile_token": "test-token"},
		reqOptions{csrf: true, ip: e.uniqueIP()})
	mustErrCode(t, rr, http.StatusUnauthorized, "invalid-credentials")
	// Token is single-use.
	rr = e.do(t, "POST", "/api/auth/reset-password",
		map[string]any{"token": token, "newPassword": e.testPassword(), "turnstile_token": "test-token"},
		reqOptions{csrf: true, ip: e.uniqueIP()})
	mustErrCode(t, rr, http.StatusBadRequest, "invalid-token")
}

func TestResetPasswordRejectsInviteToken(t *testing.T) {
	e := newTestEnv(t)
	sa := e.createUserDB(t, store.RoleSuperAdmin, store.StatusActive)
	saCookie := e.sessionCookieDB(t, sa)
	email := e.uniqueEmail()
	rr := e.do(t, "POST", "/api/admin/users", adminCreateBody(email, "", "admin"),
		reqOptions{csrf: true, ip: e.uniqueIP(), cookies: []*http.Cookie{saCookie}})
	mustStatus(t, rr, http.StatusCreated)
	invite := e.mailer.lastToken(t)
	rr = e.do(t, "POST", "/api/auth/reset-password",
		map[string]any{"token": invite, "newPassword": e.testPassword(), "turnstile_token": "test-token"},
		reqOptions{csrf: true, ip: e.uniqueIP()})
	mustErrCode(t, rr, http.StatusBadRequest, "invalid-token")
}

func TestAcceptInviteHappyPath(t *testing.T) {
	e := newTestEnv(t)
	sa := e.createUserDB(t, store.RoleSuperAdmin, store.StatusActive)
	saCookie := e.sessionCookieDB(t, sa)
	email := e.uniqueEmail()
	rr := e.do(t, "POST", "/api/admin/users", adminCreateBody(email, "", "admin"),
		reqOptions{csrf: true, ip: e.uniqueIP(), cookies: []*http.Cookie{saCookie}})
	mustStatus(t, rr, http.StatusCreated)
	u := decodeUser(t, rr)
	if u.Status != store.StatusInvited || u.Role != store.RoleAdmin {
		t.Fatalf("invited user: %+v", u)
	}
	token := e.mailer.lastToken(t)
	pw := e.testPassword()
	rr = e.do(t, "POST", "/api/auth/accept-invite",
		map[string]any{"token": token, "newPassword": pw, "turnstile_token": "test-token"},
		reqOptions{csrf: true, ip: e.uniqueIP()})
	mustStatus(t, rr, http.StatusOK)
	u = decodeUser(t, rr)
	if u.Status != store.StatusActive || u.EmailVerifiedAt == nil {
		t.Fatalf("accepted user: %+v", u)
	}
	if sessionCookie(rr) == nil {
		t.Fatal("accept-invite must log the user in")
	}
	// Login works with the new password.
	c := e.loginViaAPI(t, email, pw)
	rr = e.do(t, "GET", "/api/auth/me", nil, reqOptions{cookies: []*http.Cookie{c}})
	mustStatus(t, rr, http.StatusOK)
	// Invite token is single-use.
	rr = e.do(t, "POST", "/api/auth/accept-invite",
		map[string]any{"token": token, "newPassword": e.testPassword(), "turnstile_token": "test-token"},
		reqOptions{csrf: true, ip: e.uniqueIP()})
	mustErrCode(t, rr, http.StatusBadRequest, "invalid-token")
}

func TestAcceptInviteRejectsResetToken(t *testing.T) {
	e := newTestEnv(t)
	u, _ := e.activeCustomer(t)
	rr := e.do(t, "POST", "/api/auth/forgot-password",
		map[string]any{"email": u.Email, "turnstile_token": "test-token"},
		reqOptions{csrf: true, ip: e.uniqueIP()})
	mustStatus(t, rr, http.StatusOK)
	reset := e.mailer.lastToken(t)
	rr = e.do(t, "POST", "/api/auth/accept-invite",
		map[string]any{"token": reset, "newPassword": e.testPassword(), "turnstile_token": "test-token"},
		reqOptions{csrf: true, ip: e.uniqueIP()})
	mustErrCode(t, rr, http.StatusBadRequest, "invalid-token")
}

// ------------------------------------------------------------------- change-password

func TestChangePassword(t *testing.T) {
	e := newTestEnv(t)
	email := e.uniqueEmail()
	pw := e.testPassword()
	rr := e.do(t, "POST", "/api/auth/signup", signupBody(email, pw), reqOptions{csrf: true, ip: e.uniqueIP()})
	mustStatus(t, rr, http.StatusCreated)
	e.verifyViaAPI(t, email, []*http.Cookie{sessionCookie(rr)})
	c := e.loginViaAPI(t, email, pw)
	other := e.loginViaAPI(t, email, pw) // second device

	// Wrong current password.
	rr = e.do(t, "POST", "/api/auth/change-password",
		map[string]any{"currentPassword": "Wrong!Pass9", "newPassword": e.testPassword()},
		reqOptions{csrf: true, ip: e.uniqueIP(), cookies: []*http.Cookie{c}})
	mustErrCode(t, rr, http.StatusUnauthorized, "invalid-credentials")

	newPW := e.testPassword()
	rr = e.do(t, "POST", "/api/auth/change-password",
		map[string]any{"currentPassword": pw, "newPassword": newPW},
		reqOptions{csrf: true, ip: e.uniqueIP(), cookies: []*http.Cookie{c}})
	mustStatus(t, rr, http.StatusOK)
	fresh := sessionCookie(rr)
	if fresh == nil {
		t.Fatal("change-password must return a fresh session cookie")
	}
	// The other session is gone, the current one still works (fresh
	// session cookie returned).
	rr = e.do(t, "GET", "/api/auth/me", nil, reqOptions{cookies: []*http.Cookie{other}})
	mustStatus(t, rr, http.StatusUnauthorized)
	rr = e.do(t, "GET", "/api/auth/me", nil, reqOptions{cookies: []*http.Cookie{fresh}})
	mustStatus(t, rr, http.StatusOK)
	// New password works.
	_ = e.loginViaAPI(t, email, newPW)
}

// ------------------------------------------------------------------- admin users

func TestAdminCreateUser(t *testing.T) {
	e := newTestEnv(t)
	sa := e.createUserDB(t, store.RoleSuperAdmin, store.StatusActive)
	saCookie := e.sessionCookieDB(t, sa)

	// super_admin creates an admin: invited + invite mail.
	email := e.uniqueEmail()
	rr := e.do(t, "POST", "/api/admin/users", adminCreateBody(email, "", "admin"),
		reqOptions{csrf: true, ip: e.uniqueIP(), cookies: []*http.Cookie{saCookie}})
	mustStatus(t, rr, http.StatusCreated)
	u := decodeUser(t, rr)
	if u.Role != store.RoleAdmin || u.Status != store.StatusInvited {
		t.Fatalf("admin user: %+v", u)
	}
	mails := e.mailer.mails()
	if len(mails) != 1 || !strings.Contains(mails[0].HTML, "/accept-invite?token=") {
		t.Fatalf("invite mail: %+v", mails)
	}

	// super_admin creating a super_admin: 403.
	rr = e.do(t, "POST", "/api/admin/users", adminCreateBody(e.uniqueEmail(), e.testPassword(), "super_admin"),
		reqOptions{csrf: true, ip: e.uniqueIP(), cookies: []*http.Cookie{saCookie}})
	mustErrCode(t, rr, http.StatusForbidden, "cannot-create-super-admin")

	// admin creates a customer: OK, pending + OTP mail.
	admin := e.createUserDB(t, store.RoleAdmin, store.StatusActive)
	adminCookie := e.sessionCookieDB(t, admin)
	before := len(e.mailer.mails())
	custEmail := e.uniqueEmail()
	rr = e.do(t, "POST", "/api/admin/users", adminCreateBody(custEmail, e.testPassword(), "customer"),
		reqOptions{csrf: true, ip: e.uniqueIP(), cookies: []*http.Cookie{adminCookie}})
	mustStatus(t, rr, http.StatusCreated)
	u = decodeUser(t, rr)
	if u.Role != store.RoleCustomer || u.Status != store.StatusPending {
		t.Fatalf("customer user: %+v", u)
	}
	mails = e.mailer.mails()
	if len(mails) != before+1 || mails[len(mails)-1].To != custEmail {
		t.Fatalf("expected OTP mail to customer: %+v", mails)
	}
	// Admin-created customers DO keep their billing address (only the
	// public signup stopped collecting it).
	ab, err := e.billing.GetByUserID(context.Background(), u.ID)
	if err != nil {
		t.Fatalf("admin-created customer billing lookup: %v", err)
	}
	if ab.Pincode != "411001" || ab.City != "Pune" {
		t.Fatalf("admin-created customer billing: %+v", ab)
	}

	// admin creating staff: 403.
	rr = e.do(t, "POST", "/api/admin/users", adminCreateBody(e.uniqueEmail(), "", "admin"),
		reqOptions{csrf: true, ip: e.uniqueIP(), cookies: []*http.Cookie{adminCookie}})
	mustStatus(t, rr, http.StatusForbidden)

	// admin creating with no role: forced to customer.
	rr = e.do(t, "POST", "/api/admin/users", adminCreateBody(e.uniqueEmail(), e.testPassword(), ""),
		reqOptions{csrf: true, ip: e.uniqueIP(), cookies: []*http.Cookie{adminCookie}})
	mustStatus(t, rr, http.StatusCreated)
	if got := decodeUser(t, rr); got.Role != store.RoleCustomer {
		t.Fatalf("forced role: %s", got.Role)
	}

	// customer_service creating a user: 403.
	cs := e.createUserDB(t, store.RoleCustomerService, store.StatusActive)
	csCookie := e.sessionCookieDB(t, cs)
	rr = e.do(t, "POST", "/api/admin/users", adminCreateBody(e.uniqueEmail(), e.testPassword(), "customer"),
		reqOptions{csrf: true, ip: e.uniqueIP(), cookies: []*http.Cookie{csCookie}})
	mustStatus(t, rr, http.StatusForbidden)

	// customer hitting POST /admin/users at all: 403.
	cust, cCookie := e.activeCustomer(t)
	_ = cust
	rr = e.do(t, "POST", "/api/admin/users", adminCreateBody(e.uniqueEmail(), e.testPassword(), "customer"),
		reqOptions{csrf: true, ip: e.uniqueIP(), cookies: []*http.Cookie{cCookie}})
	mustStatus(t, rr, http.StatusForbidden)

	// Duplicate email: 409.
	rr = e.do(t, "POST", "/api/admin/users", adminCreateBody(custEmail, e.testPassword(), "customer"),
		reqOptions{csrf: true, ip: e.uniqueIP(), cookies: []*http.Cookie{saCookie}})
	mustErrCode(t, rr, http.StatusConflict, "exists")
}

func TestAdminListAndGetUsers(t *testing.T) {
	e := newTestEnv(t)
	sa := e.createUserDB(t, store.RoleSuperAdmin, store.StatusActive)
	saCookie := e.sessionCookieDB(t, sa)
	a1 := e.createUserDB(t, store.RoleAdmin, store.StatusActive)
	c1, _ := e.activeCustomer(t)

	rr := e.do(t, "GET", "/api/admin/users", nil, reqOptions{cookies: []*http.Cookie{saCookie}})
	mustStatus(t, rr, http.StatusOK)
	var list struct {
		Users []*store.User `json:"users"`
		Total int           `json:"total"`
		Page  int           `json:"page"`
		Pages int           `json:"pages"`
	}
	if err := json.Unmarshal(rr.Body.Bytes(), &list); err != nil {
		t.Fatalf("decode list: %v", err)
	}
	if list.Total != 3 || len(list.Users) != 3 || list.Page != 1 || list.Pages != 1 {
		t.Fatalf("list: %+v", list)
	}
	// Role filter.
	rr = e.do(t, "GET", "/api/admin/users?role=admin", nil, reqOptions{cookies: []*http.Cookie{saCookie}})
	mustStatus(t, rr, http.StatusOK)
	_ = json.Unmarshal(rr.Body.Bytes(), &list)
	if list.Total != 1 || list.Users[0].ID != a1.ID {
		t.Fatalf("role filter: %+v", list)
	}
	// Search filter.
	rr = e.do(t, "GET", "/api/admin/users?q="+c1.Email, nil, reqOptions{cookies: []*http.Cookie{saCookie}})
	mustStatus(t, rr, http.StatusOK)
	_ = json.Unmarshal(rr.Body.Bytes(), &list)
	if list.Total != 1 {
		t.Fatalf("q filter: %+v", list)
	}
	// Get one user.
	rr = e.do(t, "GET", "/api/admin/users/"+a1.ID, nil, reqOptions{cookies: []*http.Cookie{saCookie}})
	mustStatus(t, rr, http.StatusOK)
	if got := decodeUser(t, rr); got.ID != a1.ID {
		t.Fatalf("get user: %+v", got)
	}
	// Missing user: 404. Bad UUID: 404 too.
	rr = e.do(t, "GET", "/api/admin/users/00000000-0000-0000-0000-000000000000", nil, reqOptions{cookies: []*http.Cookie{saCookie}})
	mustErrCode(t, rr, http.StatusNotFound, "not-found")
	rr = e.do(t, "GET", "/api/admin/users/not-a-uuid", nil, reqOptions{cookies: []*http.Cookie{saCookie}})
	mustErrCode(t, rr, http.StatusNotFound, "not-found")
	// Non-super_admin: 403.
	adminCookie := e.sessionCookieDB(t, a1)
	rr = e.do(t, "GET", "/api/admin/users", nil, reqOptions{cookies: []*http.Cookie{adminCookie}})
	mustStatus(t, rr, http.StatusForbidden)
}

func TestAdminRoleAndStatusGuards(t *testing.T) {
	e := newTestEnv(t)
	sa := e.createUserDB(t, store.RoleSuperAdmin, store.StatusActive)
	saCookie := e.sessionCookieDB(t, sa)
	admin := e.createUserDB(t, store.RoleAdmin, store.StatusActive)
	adminCookie := e.sessionCookieDB(t, admin)

	// Demote the super_admin: 403.
	rr := e.do(t, "PATCH", "/api/admin/users/"+sa.ID+"/role",
		map[string]any{"role": "admin"},
		reqOptions{csrf: true, ip: e.uniqueIP(), cookies: []*http.Cookie{saCookie}})
	mustErrCode(t, rr, http.StatusForbidden, "cannot-demote-super-admin")
	// Self role change: 403.
	rr = e.do(t, "PATCH", "/api/admin/users/"+sa.ID+"/role",
		map[string]any{"role": "customer"},
		reqOptions{csrf: true, ip: e.uniqueIP(), cookies: []*http.Cookie{saCookie}})
	// super_admin guard fires first (target is super_admin) — still 403.
	mustStatus(t, rr, http.StatusForbidden)
	// Self status change: 403.
	rr = e.do(t, "PATCH", "/api/admin/users/"+sa.ID+"/status",
		map[string]any{"status": "disabled"},
		reqOptions{csrf: true, ip: e.uniqueIP(), cookies: []*http.Cookie{saCookie}})
	mustStatus(t, rr, http.StatusForbidden)
	// Assign super_admin role: 403.
	rr = e.do(t, "PATCH", "/api/admin/users/"+admin.ID+"/role",
		map[string]any{"role": "super_admin"},
		reqOptions{csrf: true, ip: e.uniqueIP(), cookies: []*http.Cookie{saCookie}})
	mustStatus(t, rr, http.StatusForbidden)
	// Invalid role value: 400.
	rr = e.do(t, "PATCH", "/api/admin/users/"+admin.ID+"/role",
		map[string]any{"role": "wizard"},
		reqOptions{csrf: true, ip: e.uniqueIP(), cookies: []*http.Cookie{saCookie}})
	mustErrCode(t, rr, http.StatusBadRequest, "validation-failed")
	// Invalid status value (pending is not allowed here): 400.
	rr = e.do(t, "PATCH", "/api/admin/users/"+admin.ID+"/status",
		map[string]any{"status": "pending"},
		reqOptions{csrf: true, ip: e.uniqueIP(), cookies: []*http.Cookie{saCookie}})
	mustErrCode(t, rr, http.StatusBadRequest, "validation-failed")
	// Non-super_admin changing roles: 403.
	rr = e.do(t, "PATCH", "/api/admin/users/"+admin.ID+"/role",
		map[string]any{"role": "customer_service"},
		reqOptions{csrf: true, ip: e.uniqueIP(), cookies: []*http.Cookie{adminCookie}})
	mustStatus(t, rr, http.StatusForbidden)

	// Happy-path role change: admin -> customer_service.
	rr = e.do(t, "PATCH", "/api/admin/users/"+admin.ID+"/role",
		map[string]any{"role": "customer_service"},
		reqOptions{csrf: true, ip: e.uniqueIP(), cookies: []*http.Cookie{saCookie}})
	mustStatus(t, rr, http.StatusOK)
	if got := decodeUser(t, rr); got.Role != store.RoleCustomerService {
		t.Fatalf("role change: %+v", got)
	}

	// Disable -> sessions gone (immediate logout).
	target := e.createUserDB(t, store.RoleCustomer, store.StatusActive)
	targetCookie := e.sessionCookieDB(t, target)
	rr = e.do(t, "PATCH", "/api/admin/users/"+target.ID+"/status",
		map[string]any{"status": "disabled"},
		reqOptions{csrf: true, ip: e.uniqueIP(), cookies: []*http.Cookie{saCookie}})
	mustStatus(t, rr, http.StatusOK)
	if got := decodeUser(t, rr); got.Status != store.StatusDisabled {
		t.Fatalf("status change: %+v", got)
	}
	rr = e.do(t, "GET", "/api/auth/me", nil, reqOptions{cookies: []*http.Cookie{targetCookie}})
	mustStatus(t, rr, http.StatusUnauthorized)
	// Re-enable.
	rr = e.do(t, "PATCH", "/api/admin/users/"+target.ID+"/status",
		map[string]any{"status": "active"},
		reqOptions{csrf: true, ip: e.uniqueIP(), cookies: []*http.Cookie{saCookie}})
	mustStatus(t, rr, http.StatusOK)
}

func TestAdminResetPasswordEndpoint(t *testing.T) {
	e := newTestEnv(t)
	sa := e.createUserDB(t, store.RoleSuperAdmin, store.StatusActive)
	saCookie := e.sessionCookieDB(t, sa)
	u, c := e.activeCustomer(t)
	before := len(e.mailer.mails())
	rr := e.do(t, "POST", "/api/admin/users/"+u.ID+"/reset-password", nil,
		reqOptions{csrf: true, ip: e.uniqueIP(), cookies: []*http.Cookie{saCookie}})
	mustStatus(t, rr, http.StatusOK)
	// Session invalidated + reset mail sent.
	rr = e.do(t, "GET", "/api/auth/me", nil, reqOptions{cookies: []*http.Cookie{c}})
	mustStatus(t, rr, http.StatusUnauthorized)
	if len(e.mailer.mails()) != before+1 {
		t.Fatalf("expected a reset mail, got %d", len(e.mailer.mails()))
	}
	// The mailed token works.
	rr = e.do(t, "POST", "/api/auth/reset-password",
		map[string]any{"token": e.mailer.lastToken(t), "newPassword": e.testPassword(), "turnstile_token": "test-token"},
		reqOptions{csrf: true, ip: e.uniqueIP()})
	mustStatus(t, rr, http.StatusOK)
}

func TestResendInviteInvalidatesOld(t *testing.T) {
	e := newTestEnv(t)
	sa := e.createUserDB(t, store.RoleSuperAdmin, store.StatusActive)
	saCookie := e.sessionCookieDB(t, sa)
	email := e.uniqueEmail()
	rr := e.do(t, "POST", "/api/admin/users", adminCreateBody(email, "", "admin"),
		reqOptions{csrf: true, ip: e.uniqueIP(), cookies: []*http.Cookie{saCookie}})
	mustStatus(t, rr, http.StatusCreated)
	u := decodeUser(t, rr)
	oldToken := e.mailer.lastToken(t)

	// Resend on a non-invited user: 400.
	cust, _ := e.activeCustomer(t)
	rr = e.do(t, "POST", "/api/admin/users/"+cust.ID+"/resend-invite", nil,
		reqOptions{csrf: true, ip: e.uniqueIP(), cookies: []*http.Cookie{saCookie}})
	mustErrCode(t, rr, http.StatusBadRequest, "not-invited")

	rr = e.do(t, "POST", "/api/admin/users/"+u.ID+"/resend-invite", nil,
		reqOptions{csrf: true, ip: e.uniqueIP(), cookies: []*http.Cookie{saCookie}})
	mustStatus(t, rr, http.StatusOK)
	newToken := e.mailer.lastToken(t)
	if newToken == oldToken {
		t.Fatal("resend-invite must issue a new token")
	}
	// Old token is dead.
	rr = e.do(t, "POST", "/api/auth/accept-invite",
		map[string]any{"token": oldToken, "newPassword": e.testPassword(), "turnstile_token": "test-token"},
		reqOptions{csrf: true, ip: e.uniqueIP()})
	mustErrCode(t, rr, http.StatusBadRequest, "invalid-token")
	// New token works.
	rr = e.do(t, "POST", "/api/auth/accept-invite",
		map[string]any{"token": newToken, "newPassword": e.testPassword(), "turnstile_token": "test-token"},
		reqOptions{csrf: true, ip: e.uniqueIP()})
	mustStatus(t, rr, http.StatusOK)
}

func TestAuditLogs(t *testing.T) {
	e := newTestEnv(t)
	sa := e.createUserDB(t, store.RoleSuperAdmin, store.StatusActive)
	saCookie := e.sessionCookieDB(t, sa)
	admin := e.createUserDB(t, store.RoleAdmin, store.StatusActive)

	// Role change produces an audit row with before/after.
	rr := e.do(t, "PATCH", "/api/admin/users/"+admin.ID+"/role",
		map[string]any{"role": "customer_service"},
		reqOptions{csrf: true, ip: e.uniqueIP(), cookies: []*http.Cookie{saCookie}})
	mustStatus(t, rr, http.StatusOK)

	// Create produces an audit row with before=null.
	rr = e.do(t, "POST", "/api/admin/users", adminCreateBody(e.uniqueEmail(), e.testPassword(), "customer"),
		reqOptions{csrf: true, ip: e.uniqueIP(), cookies: []*http.Cookie{saCookie}})
	mustStatus(t, rr, http.StatusCreated)

	rr = e.do(t, "GET", "/api/admin/audit-logs", nil, reqOptions{cookies: []*http.Cookie{saCookie}})
	mustStatus(t, rr, http.StatusOK)
	var resp struct {
		Logs  []*store.AuditLog `json:"logs"`
		Total int               `json:"total"`
	}
	if err := json.Unmarshal(rr.Body.Bytes(), &resp); err != nil {
		t.Fatalf("decode audit logs: %v", err)
	}
	if resp.Total != 2 || len(resp.Logs) != 2 {
		t.Fatalf("audit logs: total=%d logs=%+v", resp.Total, resp.Logs)
	}
	var sawRole, sawCreate bool
	for _, l := range resp.Logs {
		if l.ActorUserID == nil || *l.ActorUserID != sa.ID {
			t.Fatalf("audit actor: %+v", l)
		}
		switch l.Action {
		case "user.role_changed":
			sawRole = true
			before, _ := l.Details["before"].(map[string]any)
			after, _ := l.Details["after"].(map[string]any)
			if before["role"] != "admin" || after["role"] != "customer_service" {
				t.Fatalf("role audit details: %+v", l.Details)
			}
			if before["status"] != "active" || after["status"] != "active" {
				t.Fatalf("role audit must include status: %+v", l.Details)
			}
		case "user.created":
			sawCreate = true
			if l.Details["before"] != nil {
				t.Fatalf("create audit before must be null: %+v", l.Details)
			}
			after, _ := l.Details["after"].(map[string]any)
			if after["role"] != "customer" || after["status"] != "pending" {
				t.Fatalf("create audit after: %+v", l.Details)
			}
		}
	}
	if !sawRole || !sawCreate {
		t.Fatalf("missing audit rows: role=%v create=%v", sawRole, sawCreate)
	}
	// Actor filter.
	rr = e.do(t, "GET", "/api/admin/audit-logs?actor="+sa.ID, nil, reqOptions{cookies: []*http.Cookie{saCookie}})
	mustStatus(t, rr, http.StatusOK)
	_ = json.Unmarshal(rr.Body.Bytes(), &resp)
	if resp.Total != 2 {
		t.Fatalf("actor filter: total=%d", resp.Total)
	}
	// Non-super_admin: 403.
	adminCookie := e.sessionCookieDB(t, admin)
	rr = e.do(t, "GET", "/api/admin/audit-logs", nil, reqOptions{cookies: []*http.Cookie{adminCookie}})
	mustStatus(t, rr, http.StatusForbidden)
}

// ------------------------------------------------------------------- notes

func TestOrderNotes(t *testing.T) {
	e := newTestEnv(t)
	cs := e.createUserDB(t, store.RoleCustomerService, store.StatusActive)
	csCookie := e.sessionCookieDB(t, cs)

	rr := e.do(t, "POST", "/api/admin/orders/ORD-1001/notes",
		map[string]any{"note": "Called the customer, confirmed logo."},
		reqOptions{csrf: true, ip: e.uniqueIP(), cookies: []*http.Cookie{csCookie}})
	mustStatus(t, rr, http.StatusCreated)
	var created struct {
		Note store.OrderNote `json:"note"`
	}
	if err := json.Unmarshal(rr.Body.Bytes(), &created); err != nil {
		t.Fatalf("decode note: %v", err)
	}
	if created.Note.OrderID != "ORD-1001" || created.Note.AuthorUserID != cs.ID {
		t.Fatalf("note: %+v", created.Note)
	}

	rr = e.do(t, "POST", "/api/admin/orders/ORD-1001/notes",
		map[string]any{"note": "Second note."},
		reqOptions{csrf: true, ip: e.uniqueIP(), cookies: []*http.Cookie{csCookie}})
	mustStatus(t, rr, http.StatusCreated)

	rr = e.do(t, "GET", "/api/admin/orders/ORD-1001/notes", nil, reqOptions{cookies: []*http.Cookie{csCookie}})
	mustStatus(t, rr, http.StatusOK)
	var list struct {
		Notes []*store.OrderNote `json:"notes"`
	}
	_ = json.Unmarshal(rr.Body.Bytes(), &list)
	if len(list.Notes) != 2 || list.Notes[0].Note != "Second note." {
		t.Fatalf("notes list (latest first): %+v", list.Notes)
	}

	// Empty note: 400. Too-long note: 400.
	rr = e.do(t, "POST", "/api/admin/orders/ORD-1001/notes",
		map[string]any{"note": "   "},
		reqOptions{csrf: true, ip: e.uniqueIP(), cookies: []*http.Cookie{csCookie}})
	mustErrCode(t, rr, http.StatusBadRequest, "validation-failed")
	rr = e.do(t, "POST", "/api/admin/orders/ORD-1001/notes",
		map[string]any{"note": strings.Repeat("x", 5001)},
		reqOptions{csrf: true, ip: e.uniqueIP(), cookies: []*http.Cookie{csCookie}})
	mustErrCode(t, rr, http.StatusBadRequest, "validation-failed")

	// Customer role: 403.
	_, custCookie := e.activeCustomer(t)
	rr = e.do(t, "POST", "/api/admin/orders/ORD-1001/notes",
		map[string]any{"note": "hello"},
		reqOptions{csrf: true, ip: e.uniqueIP(), cookies: []*http.Cookie{custCookie}})
	mustStatus(t, rr, http.StatusForbidden)
	rr = e.do(t, "GET", "/api/admin/orders/ORD-1001/notes", nil, reqOptions{cookies: []*http.Cookie{custCookie}})
	mustStatus(t, rr, http.StatusForbidden)
}

// ------------------------------------------------------------------- CSRF / Turnstile / Redis-down

func TestCSRFMissingToken403(t *testing.T) {
	e := newTestEnv(t)
	email := e.uniqueEmail()
	pw := e.testPassword()
	rr := e.do(t, "POST", "/api/auth/signup", signupBody(email, pw), reqOptions{csrf: true, ip: e.uniqueIP()})
	mustStatus(t, rr, http.StatusCreated)
	e.verifyViaAPI(t, email, []*http.Cookie{sessionCookie(rr)})

	// No Origin, no token at all.
	rr = e.do(t, "POST", "/api/auth/login",
		map[string]any{"email": email, "password": pw, "turnstile_token": "test-token"},
		reqOptions{ip: e.uniqueIP()})
	mustErrCode(t, rr, http.StatusForbidden, "csrf")

	// Allowed Origin but no CSRF token.
	req := httptest.NewRequest("POST", "/api/auth/login", strings.NewReader(
		`{"email":"`+email+`","password":"`+pw+`","turnstile_token":"test-token"}`))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Origin", config.DefaultAllowedOrigins[0])
	req.Header.Set("X-Forwarded-For", e.uniqueIP())
	rec := httptest.NewRecorder()
	e.handler.ServeHTTP(rec, req)
	mustErrCode(t, rec, http.StatusForbidden, "csrf")

	// Disallowed Origin with a valid token.
	token, _ := csrf.NewToken()
	req = httptest.NewRequest("POST", "/api/auth/login", strings.NewReader(
		`{"email":"`+email+`","password":"`+pw+`","turnstile_token":"test-token"}`))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Origin", "https://evil.example.com")
	req.AddCookie(&http.Cookie{Name: csrf.CookieName, Value: token})
	req.Header.Set(csrf.HeaderName, token)
	req.Header.Set("X-Forwarded-For", e.uniqueIP())
	rec = httptest.NewRecorder()
	e.handler.ServeHTTP(rec, req)
	mustErrCode(t, rec, http.StatusForbidden, "csrf")
}

func TestTurnstileFailBlocked(t *testing.T) {
	e := newTestEnv(t)
	e.turnstile.ok = false

	// Signup blocked.
	rr := e.do(t, "POST", "/api/auth/signup", signupBody(e.uniqueEmail(), e.testPassword()),
		reqOptions{csrf: true, ip: e.uniqueIP()})
	mustErrCode(t, rr, http.StatusForbidden, "turnstile-failed")

	// Missing token: 400 turnstile-required.
	e.turnstile.ok = true
	b := signupBody(e.uniqueEmail(), e.testPassword())
	delete(b, "turnstile_token")
	rr = e.do(t, "POST", "/api/auth/signup", b, reqOptions{csrf: true, ip: e.uniqueIP()})
	mustErrCode(t, rr, http.StatusBadRequest, "turnstile-required")

	// Turnstile verifier error: fail closed.
	e.turnstile.err = fmt.Errorf("cloudflare unreachable")
	rr = e.do(t, "POST", "/api/auth/signup", signupBody(e.uniqueEmail(), e.testPassword()),
		reqOptions{csrf: true, ip: e.uniqueIP()})
	mustErrCode(t, rr, http.StatusForbidden, "turnstile-failed")
}

func TestLoginRedisDown503(t *testing.T) {
	pool := testutil.SetupTestDB(t)
	t.Cleanup(pool.Close)
	// Limiter pointed at a closed port: every check fails.
	dead := redis.NewClient(&redis.Options{
		Addr: "127.0.0.1:6399", Password: "", DB: 0,
		DialTimeout: 200 * time.Millisecond, MaxRetries: 0,
	})
	t.Cleanup(func() { _ = dead.Close() })
	live := redis.NewClient(&redis.Options{Addr: "127.0.0.1:6379", Password: "testpass123", DB: 0})
	t.Cleanup(func() { _ = live.Close() })

	cfg := &config.Config{
		Env: "dev", Port: 8080, AppBaseURL: "http://localhost:8080",
		AllowedOrigins: append([]string(nil), config.DefaultAllowedOrigins...),
	}
	users := store.NewPGUserStore(pool)
	sessions := store.NewPGSessionStore(pool)
	fm := &fakeMailer{}
	ft := &fakeTurnstile{ok: true}
	authn := &middleware.Authenticator{Users: users, Sessions: sessions}
	h := server.New(server.Deps{
		Cfg: cfg, Pool: pool, Redis: live,
		Users: users, Billing: users, Sessions: sessions,
		Tokens: store.NewPGTokenStore(pool),
		Audit:  store.NewPGAuditStore(pool),
		Notes:  store.NewPGNoteStore(pool),
		Outbox: store.NewPGOutboxStore(pool),
		Mailer: fm, Turnstile: ft,
		Limiter: ratelimit.NewWithClient(dead), Auth: authn,
	})

	// Active user in the DB.
	hash, _ := auth.HashPassword("Kumb!2026-0001")
	u := &store.User{
		FullName: "Down Test", Email: "redisdown@example.com",
		PhoneNo: "+919876543210", WhatsAppNo: "+919876543210",
		Role: store.RoleCustomer, Status: store.StatusActive,
	}
	if err := users.Create(context.Background(), u, hash, nil); err != nil {
		t.Fatalf("create user: %v", err)
	}
	token, _ := csrf.NewToken()
	body := `{"email":"redisdown@example.com","password":"Kumb!2026-0001","turnstile_token":"test-token"}`
	req := httptest.NewRequest("POST", "/api/auth/login", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Origin", config.DefaultAllowedOrigins[0])
	req.AddCookie(&http.Cookie{Name: csrf.CookieName, Value: token})
	req.Header.Set(csrf.HeaderName, token)
	req.Header.Set("X-Forwarded-For", "10.99.99.99")
	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, req)
	mustErrCode(t, rr, http.StatusServiceUnavailable, "rate-limit-unavailable")
}
