package auth

import (
	"context"
	"crypto/sha1"
	"encoding/hex"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/dusmamud/kumbuild/backend/internal/config"
)

func TestValidatePasswordPolicy(t *testing.T) {
	cases := []struct {
		pw   string
		want string // "" = valid
	}{
		{"Abcdef1!", ""},
		{"Str0ng!Pass", ""},
		{"short1!", "weak-password"},  // < 8 chars
		{"abcdef1!", "weak-password"}, // no upper
		{"ABCDEF1!", "weak-password"}, // no lower
		{"Abcdefg!", "weak-password"}, // no digit
		{"Abcdef12", "weak-password"}, // no special
		{"", "weak-password"},
		{"Abc1!def", ""}, // exactly 8, all classes
	}
	for _, c := range cases {
		code, detail := ValidatePasswordPolicy(c.pw)
		if code != c.want {
			t.Errorf("password %q: code=%q detail=%q, want code %q", c.pw, code, detail, c.want)
		}
		if c.want != "" && detail == "" {
			t.Errorf("password %q: weak but no detail message", c.pw)
		}
	}
}

func TestHashVerifyRoundtrip(t *testing.T) {
	hash, err := HashPassword("Str0ng!Pass")
	if err != nil {
		t.Fatalf("HashPassword: %v", err)
	}
	if !strings.HasPrefix(hash, "$argon2id$v=19$m=19456,t=2,p=1$") {
		t.Fatalf("PHC format wrong: %s", hash)
	}
	ok, err := VerifyPassword("Str0ng!Pass", hash)
	if err != nil || !ok {
		t.Fatalf("correct password must verify: ok=%v err=%v", ok, err)
	}
	ok, err = VerifyPassword("Wrong!Pass1", hash)
	if err != nil || ok {
		t.Fatalf("wrong password must NOT verify: ok=%v err=%v", ok, err)
	}
	// Same password twice -> different salts -> different hashes.
	hash2, err := HashPassword("Str0ng!Pass")
	if err != nil {
		t.Fatalf("HashPassword: %v", err)
	}
	if hash == hash2 {
		t.Fatal("two hashes of the same password must differ (random salt)")
	}
	if ok, _ := VerifyPassword("Str0ng!Pass", hash2); !ok {
		t.Fatal("second hash must also verify")
	}
	// Garbage hash format -> (false, nil), never an error leak.
	if ok, err := VerifyPassword("x", "not-a-hash"); ok || err != nil {
		t.Fatalf("garbage hash: ok=%v err=%v", ok, err)
	}
}

func TestCheckHIBP(t *testing.T) {
	// Fake pwnedpasswords server: "password" has SHA-1 starting 5BAA6...,
	// so only requests for prefix 5BAA6 see its suffix; any other prefix
	// gets unrelated suffixes.
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !strings.HasPrefix(r.URL.Path, "/") || len(r.URL.Path) != 6 {
			t.Errorf("HIBP request path must be / + 5-char prefix, got %s", r.URL.Path)
		}
		if strings.HasSuffix(r.URL.Path, "/5BAA6") {
			fmt.Fprint(w, "1E4C9B93F3F0682250B6CF8331B7EE68FD8:3861491\r\n00D4F6E8FA6EECAD2A3AA415EEC418D38EC:2\r\n")
			return
		}
		fmt.Fprint(w, "00D4F6E8FA6EECAD2A3AA415EEC418D38EC:2\r\n")
	}))
	defer srv.Close()

	oldURL, oldClient := hibpBaseURL, hibpClient
	hibpBaseURL = srv.URL + "/"
	hibpClient = srv.Client()
	defer func() { hibpBaseURL, hibpClient = oldURL, oldClient }()

	// "password" SHA-1 starts 5BAA61E4C9B93F3F0682250B6CF8331B7EE68FD8.
	if breached, err := CheckHIBP(context.Background(), "password"); err != nil || !breached {
		t.Fatalf("known-breached password must report breached: %v %v", breached, err)
	}
	if breached, err := CheckHIBP(context.Background(), "definitely-not-breached-xyz-123!"); err != nil || breached {
		t.Fatalf("random password must not report breached: %v %v", breached, err)
	}
}

func TestCheckHIBPFailOpen(t *testing.T) {
	// Server returns 500 -> fail open: (false, nil), no error.
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
	}))
	defer srv.Close()
	oldURL, oldClient := hibpBaseURL, hibpClient
	hibpBaseURL = srv.URL + "/"
	hibpClient = srv.Client()
	defer func() { hibpBaseURL, hibpClient = oldURL, oldClient }()

	breached, err := CheckHIBP(context.Background(), "password")
	if breached || err != nil {
		t.Fatalf("HIBP outage must fail OPEN (false, nil): got (%v, %v)", breached, err)
	}

	// Unreachable host -> also fail open.
	hibpBaseURL = "http://127.0.0.1:1/range/"
	hibpClient = &http.Client{Timeout: 2 * time.Second}
	breached, err = CheckHIBP(context.Background(), "password")
	if breached || err != nil {
		t.Fatalf("HIBP network error must fail OPEN: got (%v, %v)", breached, err)
	}
}

func TestCheckHIBPSendsOnlyPrefix(t *testing.T) {
	// Prove k-anonymity: the request path must contain ONLY the first 5
	// chars of the SHA-1, never the full hash.
	pw := "some-secret-password-123!"
	sum := sha1.Sum([]byte(pw))
	full := strings.ToUpper(hex.EncodeToString(sum[:]))
	var gotPath string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotPath = r.URL.Path
		fmt.Fprint(w, "AABBCC:1\r\n")
	}))
	defer srv.Close()
	oldURL, oldClient := hibpBaseURL, hibpClient
	hibpBaseURL = srv.URL + "/"
	hibpClient = srv.Client()
	defer func() { hibpBaseURL, hibpClient = oldURL, oldClient }()

	if _, err := CheckHIBP(context.Background(), pw); err != nil {
		t.Fatalf("CheckHIBP: %v", err)
	}
	if gotPath != "/"+full[:5] {
		t.Fatalf("HIBP path = %q, want only prefix %q", gotPath, "/"+full[:5])
	}
	if strings.Contains(gotPath, full[5:]) {
		t.Fatal("HIBP request leaked the full hash suffix")
	}
}

func TestSessionTokenAndCookie(t *testing.T) {
	t1, err := NewSessionToken()
	if err != nil {
		t.Fatalf("NewSessionToken: %v", err)
	}
	t2, err := NewSessionToken()
	if err != nil {
		t.Fatalf("NewSessionToken: %v", err)
	}
	if t1 == t2 {
		t.Fatal("two session tokens must differ")
	}
	if len(t1) != 43 { // 32 bytes base64.RawURLEncoding
		t.Fatalf("token length: got %d, want 43", len(t1))
	}
	if h1, h2 := HashToken(t1), HashToken(t1); h1 != h2 {
		t.Fatal("HashToken must be deterministic")
	}
	if HashToken(t1) == HashToken(t2) {
		t.Fatal("different tokens must hash differently")
	}
	if len(HashToken(t1)) != 64 {
		t.Fatal("SHA-256 hex must be 64 chars")
	}

	dev := &config.Config{Env: "dev"}
	c := CookieForSession(t1, dev)
	if c.Name != "kb_session" || !c.HttpOnly || !c.Secure {
		t.Fatalf("dev cookie must be kb_session + HttpOnly + Secure: %+v", c)
	}
	if c.SameSite != http.SameSiteNoneMode || c.Domain != "" {
		t.Fatalf("dev cookie must be SameSite=None, no Domain: %+v", c)
	}
	if c.MaxAge != 7*24*3600 {
		t.Fatalf("MaxAge: got %d", c.MaxAge)
	}

	prod := &config.Config{Env: "prod", CookieDomain: ".kumbuild.com"}
	cp := CookieForSession(t1, prod)
	if cp.SameSite != http.SameSiteLaxMode || cp.Domain != ".kumbuild.com" {
		t.Fatalf("prod cookie must be SameSite=Lax + Domain=.kumbuild.com: %+v", cp)
	}
	cleared := ClearSessionCookie(prod)
	if cleared.MaxAge != -1 || !cleared.Expires.IsZero() && cleared.Expires.After(time.Unix(0, 0)) {
		t.Fatalf("clear cookie must expire: %+v", cleared)
	}
}

func TestGenerateOTP(t *testing.T) {
	seen := map[string]bool{}
	for i := 0; i < 200; i++ {
		code, err := GenerateOTP()
		if err != nil {
			t.Fatalf("GenerateOTP: %v", err)
		}
		if len(code) != 6 {
			t.Fatalf("OTP %q must be 6 digits", code)
		}
		for _, r := range code {
			if r < '0' || r > '9' {
				t.Fatalf("OTP %q must be digits only", code)
			}
		}
		seen[code] = true
	}
	if len(seen) < 150 { // 200 draws over 1M values should be ~200 unique
		t.Fatalf("OTP looks non-random: only %d unique in 200 draws", len(seen))
	}
	if HashOTP("123456") != HashToken("123456") {
		t.Fatal("HashOTP must equal SHA-256 hex of the code")
	}
	if HashOTP("123456") == "123456" {
		t.Fatal("OTP hash must not be the plaintext code")
	}
}
