// Package turnstile verifies Cloudflare Turnstile tokens server-side.
// Verification is mandatory and FAILS CLOSED: any network/timeout error is
// an error to the caller, never a pass.
package turnstile

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/dusmamud/kumbuild/backend/internal/config"
)

// Verifier checks a Turnstile token. (bool, nil) = verification ran and the
// token is invalid; (false, err) = verification itself failed — callers
// treat this as fail CLOSED (block the request).
type Verifier interface {
	Verify(ctx context.Context, token, remoteIP string) (bool, error)
}

// siteverifyEndpoint is the Cloudflare verify URL.
const siteverifyEndpoint = "https://challenges.cloudflare.com/turnstile/v0/siteverify"

// HTTPVerifier is the production Verifier: POST form to Cloudflare.
type HTTPVerifier struct {
	secret   string
	client   *http.Client
	endpoint string // override for tests; defaults to siteverifyEndpoint
}

// NewHTTPVerifier builds a Verifier from config (secret from env, never
// from code or logs).
func NewHTTPVerifier(cfg *config.Config) *HTTPVerifier {
	return &HTTPVerifier{
		secret:   cfg.TurnstileSecretKey,
		client:   &http.Client{Timeout: 10 * time.Second},
		endpoint: siteverifyEndpoint,
	}
}

// NewHTTPVerifierWithClient is NewHTTPVerifier with an injected client and
// endpoint (tests use an httptest server URL here).
func NewHTTPVerifierWithClient(secret string, client *http.Client, endpoint string) *HTTPVerifier {
	if endpoint == "" {
		endpoint = siteverifyEndpoint
	}
	return &HTTPVerifier{secret: secret, client: client, endpoint: endpoint}
}

type siteverifyResponse struct {
	Success    bool     `json:"success"`
	ErrorCodes []string `json:"error-codes"`
}

// Verify posts secret + response token + remote IP to Cloudflare and
// requires success == true.
func (v *HTTPVerifier) Verify(ctx context.Context, token, remoteIP string) (bool, error) {
	if strings.TrimSpace(token) == "" {
		return false, nil
	}
	form := url.Values{
		"secret":   {v.secret},
		"response": {token},
	}
	if strings.TrimSpace(remoteIP) != "" {
		form.Set("remoteip", remoteIP)
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, v.endpoint, strings.NewReader(form.Encode()))
	if err != nil {
		return false, fmt.Errorf("turnstile request: %w", err)
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	resp, err := v.client.Do(req)
	if err != nil {
		// Fail CLOSED: a verification that could not run blocks the request.
		return false, fmt.Errorf("turnstile verify: %w", err)
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if err != nil {
		return false, fmt.Errorf("turnstile read response: %w", err)
	}
	var out siteverifyResponse
	if err := json.Unmarshal(body, &out); err != nil {
		return false, fmt.Errorf("turnstile decode response: %w", err)
	}
	if !out.Success {
		slog.Warn("turnstile: verification failed", "remote_ip", remoteIP, "error_codes", out.ErrorCodes)
		return false, nil
	}
	return true, nil
}
