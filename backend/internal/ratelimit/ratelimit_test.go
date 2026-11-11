package ratelimit

import (
	"context"
	"testing"
	"time"

	"github.com/redis/go-redis/v9"
)

func testClient(t *testing.T) *redis.Client {
	t.Helper()
	c := redis.NewClient(&redis.Options{
		Addr:     "localhost:6379",
		Password: "testpass123",
		DB:       0,
	})
	if err := c.Ping(context.Background()).Err(); err != nil {
		c.Close()
		t.Skipf("test redis unreachable: %v", err)
	}
	return c
}

func TestCheckAllowsThenDenies(t *testing.T) {
	c := testClient(t)
	defer c.Close()
	ctx := context.Background()
	lim := NewWithClient(c)
	key := "test:check:1"
	_ = c.Del(ctx, key)

	for i := 1; i <= 5; i++ {
		allowed, err := lim.Check(ctx, key, 5, time.Minute)
		if err != nil || !allowed {
			t.Fatalf("attempt %d must be allowed: allowed=%v err=%v", i, allowed, err)
		}
	}
	allowed, err := lim.Check(ctx, key, 5, time.Minute)
	if err != nil || allowed {
		t.Fatalf("6th attempt must be denied: allowed=%v err=%v", allowed, err)
	}
	// Counter must have a TTL (ephemeral, not permanent).
	ttl, err := c.PTTL(ctx, key).Result()
	if err != nil || ttl <= 0 || ttl > time.Minute {
		t.Fatalf("key must expire within the window: ttl=%v err=%v", ttl, err)
	}
	_ = c.Del(ctx, key)
}

func TestHelpers(t *testing.T) {
	c := testClient(t)
	defer c.Close()
	ctx := context.Background()
	lim := NewWithClient(c)
	_ = c.FlushDB(ctx)

	// Login by IP: 5 allowed, 6th denied.
	for i := 0; i < 5; i++ {
		if ok, err := lim.AllowLoginByIP(ctx, "1.2.3.4"); err != nil || !ok {
			t.Fatalf("login ip attempt %d: ok=%v err=%v", i+1, ok, err)
		}
	}
	if ok, err := lim.AllowLoginByIP(ctx, "1.2.3.4"); err != nil || ok {
		t.Fatalf("login ip 6th must be denied: ok=%v err=%v", ok, err)
	}
	// Different IP is a different bucket.
	if ok, err := lim.AllowLoginByIP(ctx, "5.6.7.8"); err != nil || !ok {
		t.Fatalf("other IP must be allowed: ok=%v err=%v", ok, err)
	}
	// Login by email: 5 allowed, 6th denied; email is hashed into the key.
	for i := 0; i < 5; i++ {
		if ok, err := lim.AllowLoginByEmail(ctx, "u@example.com"); err != nil || !ok {
			t.Fatalf("login email attempt %d: ok=%v err=%v", i+1, ok, err)
		}
	}
	if ok, err := lim.AllowLoginByEmail(ctx, "u@example.com"); err != nil || ok {
		t.Fatalf("login email 6th must be denied: ok=%v err=%v", ok, err)
	}
	// Raw email must never appear as a Redis key.
	keys, _ := c.Keys(ctx, "*u@example.com*").Result()
	if len(keys) != 0 {
		t.Fatalf("raw email leaked into redis keys: %v", keys)
	}
	// Signup / forgot / invite / OTP helpers each allow 5 then deny.
	type helper struct {
		name string
		fn   func(context.Context) (bool, error)
	}
	helpers := []helper{
		{"signup", func(ctx context.Context) (bool, error) { return lim.AllowSignupByIP(ctx, "9.9.9.9") }},
		{"forgot", func(ctx context.Context) (bool, error) { return lim.AllowForgotByIP(ctx, "9.9.9.9") }},
		{"invite", func(ctx context.Context) (bool, error) { return lim.AllowAcceptInviteByIP(ctx, "9.9.9.9") }},
		{"otp", func(ctx context.Context) (bool, error) { return lim.AllowOTPAttempt(ctx, "user-123") }},
	}
	for _, h := range helpers {
		for i := 0; i < 5; i++ {
			if ok, err := h.fn(ctx); err != nil || !ok {
				t.Fatalf("%s attempt %d: ok=%v err=%v", h.name, i+1, ok, err)
			}
		}
		if ok, err := h.fn(ctx); err != nil || ok {
			t.Fatalf("%s 6th must be denied: ok=%v err=%v", h.name, ok, err)
		}
	}
	_ = c.FlushDB(ctx)
}

func TestCheckRedisDownFailsSafe(t *testing.T) {
	// Redis on a closed port: Check must return (false, err) — never (true, nil).
	dead := redis.NewClient(&redis.Options{
		Addr:        "127.0.0.1:6399",
		DialTimeout: 500 * time.Millisecond,
		MaxRetries:  0,
	})
	defer dead.Close()
	lim := NewWithClient(dead)
	allowed, err := lim.Check(context.Background(), "x", 5, time.Minute)
	if err == nil {
		t.Fatal("redis down must return an error")
	}
	if allowed {
		t.Fatal("redis down must NOT allow the request (fail safe)")
	}
	if ok, err := lim.AllowLoginByIP(context.Background(), "1.1.1.1"); err == nil || ok {
		t.Fatalf("AllowLoginByIP redis down: ok=%v err=%v", ok, err)
	}
}
