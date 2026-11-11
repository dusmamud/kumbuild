// Package auth holds the pure auth logic: password hashing/policy, input
// validation, session tokens and OTP codes. No HTTP handlers live here.
package auth

import (
	"context"
	"crypto/rand"
	"crypto/sha1"
	"crypto/subtle"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"strings"
	"time"
	"unicode"

	"golang.org/x/crypto/argon2"
)

// Argon2id parameters — COMPILE-TIME constants, never env vars
// (backend/README.md §6). OWASP minimum is 19 MiB; the 1GB VPS caps us at
// 2 concurrent hashes so a login burst cannot OOM the box.
const (
	argonMemoryKiB   = 19 * 1024 // 19 MiB
	argonTime        = 2
	argonParallelism = 1
	argonSaltLen     = 16
	argonKeyLen      = 32

	// maxConcurrentHashes bounds simultaneous Argon2id work.
	maxConcurrentHashes = 2
)

// hashSemaphore limits concurrent Argon2id hashing to 2.
var hashSemaphore = make(chan struct{}, maxConcurrentHashes)

// HashPassword hashes a password with Argon2id and returns a PHC string:
// $argon2id$v=19$m=19456,t=2,p=1$<b64salt>$<b64hash>
func HashPassword(password string) (string, error) {
	hashSemaphore <- struct{}{}
	defer func() { <-hashSemaphore }()

	salt := make([]byte, argonSaltLen)
	if _, err := rand.Read(salt); err != nil {
		return "", fmt.Errorf("generate salt: %w", err)
	}
	hash := argon2.IDKey([]byte(password), salt, argonTime, argonMemoryKiB, argonParallelism, argonKeyLen)
	return fmt.Sprintf("$argon2id$v=19$m=%d,t=%d,p=%d$%s$%s",
		argonMemoryKiB, argonTime, argonParallelism,
		base64.RawStdEncoding.EncodeToString(salt),
		base64.RawStdEncoding.EncodeToString(hash)), nil
}

// VerifyPassword checks a password against a PHC Argon2id hash using a
// constant-time comparison. Unknown formats return (false, nil) — never an
// error that leaks which accounts exist.
func VerifyPassword(password, encoded string) (bool, error) {
	salt, hash, mem, t, p, err := parsePHC(encoded)
	if err != nil {
		return false, nil
	}
	// Re-hash under the same semaphore: verification costs the same memory.
	hashSemaphore <- struct{}{}
	defer func() { <-hashSemaphore }()

	other := argon2.IDKey([]byte(password), salt, t, mem, p, uint32(len(hash)))
	return subtle.ConstantTimeCompare(hash, other) == 1, nil
}

func parsePHC(encoded string) (salt, hash []byte, mem, t uint32, p uint8, err error) {
	parts := strings.Split(encoded, "$")
	// ["", "argon2id", "v=19", "m=19456,t=2,p=1", salt, hash]
	if len(parts) != 6 || parts[1] != "argon2id" {
		return nil, nil, 0, 0, 0, errors.New("unsupported hash format")
	}
	var version int
	if _, err := fmt.Sscanf(parts[2], "v=%d", &version); err != nil || version != 19 {
		return nil, nil, 0, 0, 0, errors.New("unsupported argon2 version")
	}
	var m uint32
	var ti uint32
	var pa uint8
	if _, err := fmt.Sscanf(parts[3], "m=%d,t=%d,p=%d", &m, &ti, &pa); err != nil {
		return nil, nil, 0, 0, 0, errors.New("bad argon2 params")
	}
	salt, err = base64.RawStdEncoding.DecodeString(parts[4])
	if err != nil {
		return nil, nil, 0, 0, 0, fmt.Errorf("bad salt: %w", err)
	}
	hash, err = base64.RawStdEncoding.DecodeString(parts[5])
	if err != nil {
		return nil, nil, 0, 0, 0, fmt.Errorf("bad hash: %w", err)
	}
	return salt, hash, m, ti, pa, nil
}

// ------------------------------------------------------------------- policy

// ValidatePasswordPolicy enforces the single password policy used by
// signup, accept-invite, reset and change-password: min 8 chars, at least
// one upper, one lower, one digit and one special character.
// Returns the field error code "weak-password" plus a detail string.
func ValidatePasswordPolicy(password string) (code, detail string) {
	var hasUpper, hasLower, hasDigit, hasSpecial bool
	for _, r := range password {
		switch {
		case unicode.IsUpper(r):
			hasUpper = true
		case unicode.IsLower(r):
			hasLower = true
		case unicode.IsDigit(r):
			hasDigit = true
		case unicode.IsPunct(r) || unicode.IsSymbol(r):
			hasSpecial = true
		}
	}
	switch {
	case len([]rune(password)) < 8:
		return "weak-password", "password must be at least 8 characters"
	case !hasUpper:
		return "weak-password", "password must contain an uppercase letter"
	case !hasLower:
		return "weak-password", "password must contain a lowercase letter"
	case !hasDigit:
		return "weak-password", "password must contain a digit"
	case !hasSpecial:
		return "weak-password", "password must contain a special character"
	}
	return "", ""
}

// --------------------------------------------------------------------- HIBP

// hibpClient is swappable in tests.
var hibpClient = &http.Client{Timeout: 5 * time.Second}

// hibpBaseURL is swappable in tests (httptest server).
var hibpBaseURL = "https://api.pwnedpasswords.com/range/"

// CheckHIBP reports whether password appears in the Have I Been Pwned
// breach corpus, via the k-anonymity range API (only the first 5 chars of
// the SHA-1 are sent — the full hash never leaves this box).
//
// DELIBERATE CHOICE — fail OPEN on network error: if the third-party HIBP
// API is down or unreachable, we log it and return (false, nil) so signup
// is not blocked by someone else's outage. A breach check is a hardening
// layer, not the password policy itself (the policy still applies), and
// blocking all signups because an external API is down would be a
// self-inflicted outage. Callers must still enforce ValidatePasswordPolicy.
func CheckHIBP(ctx context.Context, password string) (breached bool, err error) {
	sum := sha1.Sum([]byte(password))
	hexHash := strings.ToUpper(hex.EncodeToString(sum[:]))
	prefix, suffix := hexHash[:5], hexHash[5:]

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, hibpBaseURL+prefix, nil)
	if err != nil {
		slog.Warn("hibp: build request failed", "error", err)
		return false, nil
	}
	req.Header.Set("User-Agent", "kumbuild-auth")
	resp, err := hibpClient.Do(req)
	if err != nil {
		slog.Warn("hibp: lookup failed, failing open", "error", err)
		return false, nil
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		slog.Warn("hibp: unexpected status, failing open", "status", resp.StatusCode)
		return false, nil
	}
	body, err := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if err != nil {
		slog.Warn("hibp: read failed, failing open", "error", err)
		return false, nil
	}
	// Each line: "<suffix>:<count>". Suffixes are uppercase hex.
	for _, line := range strings.Split(string(body), "\n") {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}
		if got, _, ok := strings.Cut(line, ":"); ok && strings.EqualFold(got, suffix) {
			return true, nil
		}
	}
	return false, nil
}
