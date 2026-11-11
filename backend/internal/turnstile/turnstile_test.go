package turnstile

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func testServer(t *testing.T, success bool, codes []string) (*httptest.Server, *HTTPVerifier) {
	t.Helper()
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			t.Errorf("turnstile must POST, got %s", r.Method)
		}
		if err := r.ParseForm(); err != nil {
			t.Errorf("parse form: %v", err)
		}
		if r.Form.Get("secret") != "test-secret" {
			t.Errorf("secret not posted: %q", r.Form.Get("secret"))
		}
		if r.Form.Get("response") != "test-token" {
			t.Errorf("token not posted: %q", r.Form.Get("response"))
		}
		if r.Form.Get("remoteip") != "1.2.3.4" {
			t.Errorf("remoteip not posted: %q", r.Form.Get("remoteip"))
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{
			"success": success, "error-codes": codes,
		})
	}))
	v := NewHTTPVerifierWithClient("test-secret", srv.Client(), srv.URL)
	return srv, v
}

func TestVerifySuccess(t *testing.T) {
	srv, v := testServer(t, true, nil)
	defer srv.Close()
	ok, err := v.Verify(context.Background(), "test-token", "1.2.3.4")
	if err != nil || !ok {
		t.Fatalf("success response must verify: ok=%v err=%v", ok, err)
	}
}

func TestVerifyFailure(t *testing.T) {
	srv, v := testServer(t, false, []string{"invalid-input-response"})
	defer srv.Close()
	ok, err := v.Verify(context.Background(), "test-token", "1.2.3.4")
	if err != nil {
		t.Fatalf("failed verification must return (false, nil), got err %v", err)
	}
	if ok {
		t.Fatal("failed verification must return false")
	}
}

func TestVerifyEmptyToken(t *testing.T) {
	srv, v := testServer(t, true, nil)
	defer srv.Close()
	ok, err := v.Verify(context.Background(), "", "1.2.3.4")
	if err != nil || ok {
		t.Fatalf("empty token must return (false, nil): (%v, %v)", ok, err)
	}
}

func TestVerifyNetworkErrorFailsClosed(t *testing.T) {
	// Closed server -> network error -> (false, err), NOT a pass.
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		fmt.Fprint(w, `{"success":true}`)
	}))
	v := NewHTTPVerifierWithClient("test-secret", srv.Client(), srv.URL)
	srv.Close()
	ok, err := v.Verify(context.Background(), "test-token", "1.2.3.4")
	if err == nil {
		t.Fatal("network error must return an error (fail closed)")
	}
	if ok {
		t.Fatal("network error must not verify")
	}
}

func TestVerifyTimeoutFailsClosed(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		time.Sleep(2 * time.Second)
		fmt.Fprint(w, `{"success":true}`)
	}))
	defer srv.Close()
	v := NewHTTPVerifierWithClient("test-secret", &http.Client{Timeout: 200 * time.Millisecond}, srv.URL)
	ok, err := v.Verify(context.Background(), "test-token", "1.2.3.4")
	if err == nil || ok {
		t.Fatalf("timeout must fail closed: (%v, %v)", ok, err)
	}
}
