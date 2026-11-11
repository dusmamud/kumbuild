// Package ratelimit enforces per-IP / per-account rate limits in Redis.
// Redis is ONLY for ephemeral counters — sessions live in Postgres.
//
// FAIL SAFE: on ANY Redis error Check returns (false, err). Callers map
// that to 503 — throttling is never silently bypassed because Redis is down.
package ratelimit

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"time"

	"github.com/redis/go-redis/v9"
)

// Key prefixes (exported so handlers and tests use the same keys).
const (
	PrefixLoginIP    = "rl:login:ip:"
	PrefixLoginEmail = "rl:login:email:"
	PrefixSignupIP   = "rl:signup:ip:"
	PrefixForgotIP   = "rl:forgot:ip:"
	PrefixInviteIP   = "rl:invite:ip:"
	PrefixOTP        = "rl:otp:"
)

// Limits (AUTH_PLAN.md §9): 5 per 60s, except OTP attempts 5 per 10 min.
const (
	loginLimit   = 5
	loginWindow  = 60 * time.Second
	signupLimit  = 5
	signupWindow = 60 * time.Second
	forgotLimit  = 5
	forgotWindow = 60 * time.Second
	inviteLimit  = 5
	inviteWindow = 60 * time.Second
	otpLimit     = 5
	otpWindow    = 10 * time.Minute
)

// checkScript increments the counter and sets the TTL only on first
// creation — atomic, so concurrent requests cannot reset each other's TTL.
const checkScript = `
local n = redis.call("INCR", KEYS[1])
if n == 1 then
  redis.call("PEXPIRE", KEYS[1], ARGV[1])
end
return n
`

// Limiter wraps a Redis client.
type Limiter struct {
	client *redis.Client
}

// New builds a Limiter for addr (e.g. "localhost:6379") and password.
func New(addr, password string) *Limiter {
	return &Limiter{
		client: redis.NewClient(&redis.Options{
			Addr:     addr,
			Password: password,
			DB:       0,
		}),
	}
}

// NewWithClient builds a Limiter around an existing client (tests).
func NewWithClient(client *redis.Client) *Limiter { return &Limiter{client: client} }

// Close releases the Redis connection.
func (l *Limiter) Close() error { return l.client.Close() }

// Check increments the counter for key and reports whether the request is
// within limit for window. On ANY Redis error it returns (false, err) —
// fail safe, never bypass.
func (l *Limiter) Check(ctx context.Context, key string, limit int, window time.Duration) (bool, error) {
	n, err := l.client.Eval(ctx, checkScript, []string{key}, window.Milliseconds()).Int64()
	if err != nil {
		return false, fmt.Errorf("ratelimit check %s: %w", key, err)
	}
	return n <= int64(limit), nil
}

// AllowLoginByIP limits login attempts per IP: 5 per 60s.
func (l *Limiter) AllowLoginByIP(ctx context.Context, ip string) (bool, error) {
	return l.Check(ctx, PrefixLoginIP+ip, loginLimit, loginWindow)
}

// AllowLoginByEmail limits login attempts per account (email SHA-256 — the
// raw email is never used as a Redis key): 5 per 60s.
func (l *Limiter) AllowLoginByEmail(ctx context.Context, email string) (bool, error) {
	sum := sha256.Sum256([]byte(email))
	return l.Check(ctx, PrefixLoginEmail+hex.EncodeToString(sum[:]), loginLimit, loginWindow)
}

// AllowSignupByIP limits signups per IP: 5 per 60s.
func (l *Limiter) AllowSignupByIP(ctx context.Context, ip string) (bool, error) {
	return l.Check(ctx, PrefixSignupIP+ip, signupLimit, signupWindow)
}

// AllowForgotByIP limits forgot-password requests per IP: 5 per 60s.
func (l *Limiter) AllowForgotByIP(ctx context.Context, ip string) (bool, error) {
	return l.Check(ctx, PrefixForgotIP+ip, forgotLimit, forgotWindow)
}

// AllowAcceptInviteByIP limits invite-accept attempts per IP: 5 per 60s.
func (l *Limiter) AllowAcceptInviteByIP(ctx context.Context, ip string) (bool, error) {
	return l.Check(ctx, PrefixInviteIP+ip, inviteLimit, inviteWindow)
}

// AllowOTPAttempt limits OTP verification attempts per user: 5 per 10 min.
func (l *Limiter) AllowOTPAttempt(ctx context.Context, userID string) (bool, error) {
	return l.Check(ctx, PrefixOTP+userID, otpLimit, otpWindow)
}
