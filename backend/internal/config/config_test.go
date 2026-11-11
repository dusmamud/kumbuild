package config

import (
	"os"
	"testing"
)

func setEnv(t *testing.T, k, v string) {
	t.Helper()
	t.Setenv(k, v)
}

func TestLoadDefaults(t *testing.T) {
	for _, k := range []string{"APP_ENV", "PORT", "DATABASE_URL", "REDIS_ADDR", "REDIS_PASSWORD",
		"BREVO_API_KEY", "MAIL_FROM_EMAIL", "MAIL_FROM_NAME", "APP_BASE_URL",
		"TURNSTILE_SECRET_KEY", "COOKIE_DOMAIN", "ALLOWED_ORIGINS"} {
		t.Setenv(k, "")
	}
	os.Unsetenv("DATABASE_URL")
	os.Unsetenv("BREVO_API_KEY")
	os.Unsetenv("TURNSTILE_SECRET_KEY")
	setEnv(t, "DATABASE_URL", "postgres://localhost/test")
	setEnv(t, "BREVO_API_KEY", "key-123")
	setEnv(t, "TURNSTILE_SECRET_KEY", "secret-123")

	cfg, err := Load()
	if err != nil {
		t.Fatalf("Load: %v", err)
	}
	if cfg.Env != "dev" || cfg.Port != 8080 {
		t.Fatalf("defaults: env=%q port=%d", cfg.Env, cfg.Port)
	}
	if cfg.RedisAddr != "localhost:6379" {
		t.Fatalf("redis addr default: %q", cfg.RedisAddr)
	}
	if cfg.AppBaseURL != "http://localhost:8080" {
		t.Fatalf("base url default: %q", cfg.AppBaseURL)
	}
	if cfg.CookieDomain != "" {
		t.Fatalf("dev cookie domain must be empty, got %q", cfg.CookieDomain)
	}
	if len(cfg.AllowedOrigins) != 9 {
		t.Fatalf("default origins: want 9 (7 pages.dev + 2 localhost), got %d: %v",
			len(cfg.AllowedOrigins), cfg.AllowedOrigins)
	}
	want := map[string]bool{
		"https://kumbuild-web.pages.dev": true, "https://kumbuild-account.pages.dev": true,
		"https://kumbuild-admin.pages.dev": true, "https://kumbuild-home.pages.dev": true,
		"https://kumbuild-blog.pages.dev": true, "https://kumbuild-docs.pages.dev": true,
		"https://kumbuild-app.pages.dev": true, "http://localhost:5173": true,
		"http://localhost:3000": true,
	}
	for _, o := range cfg.AllowedOrigins {
		if !want[o] {
			t.Fatalf("unexpected default origin %q", o)
		}
	}
}

func TestLoadProdCookieDomain(t *testing.T) {
	setEnv(t, "DATABASE_URL", "postgres://localhost/test")
	setEnv(t, "BREVO_API_KEY", "key-123")
	setEnv(t, "TURNSTILE_SECRET_KEY", "secret-123")
	setEnv(t, "APP_ENV", "prod")
	cfg, err := Load()
	if err != nil {
		t.Fatalf("Load: %v", err)
	}
	if cfg.CookieDomain != ".kumbuild.com" {
		t.Fatalf("prod cookie domain: got %q", cfg.CookieDomain)
	}
	if !cfg.IsProd() {
		t.Fatal("IsProd must be true in prod")
	}
}

func TestLoadMissingRequired(t *testing.T) {
	os.Unsetenv("DATABASE_URL")
	os.Unsetenv("BREVO_API_KEY")
	os.Unsetenv("TURNSTILE_SECRET_KEY")
	setEnv(t, "DATABASE_URL", "postgres://localhost/test")
	// BREVO_API_KEY + TURNSTILE_SECRET_KEY missing
	_, err := Load()
	if err == nil {
		t.Fatal("Load must fail when required vars are missing")
	}
	for _, want := range []string{"BREVO_API_KEY", "TURNSTILE_SECRET_KEY"} {
		if !contains(err.Error(), want) {
			t.Fatalf("error %q must name %s", err, want)
		}
	}
}

func TestLoadMailFallbacks(t *testing.T) {
	setEnv(t, "DATABASE_URL", "postgres://localhost/test")
	setEnv(t, "BREVO_API_KEY", "key-123")
	setEnv(t, "TURNSTILE_SECRET_KEY", "secret-123")
	setEnv(t, "MAIL_FROM_EMAIL", "hello@kumbuild.com")
	setEnv(t, "MAIL_FROM_NAME", "Kumbuild")
	cfg, err := Load()
	if err != nil {
		t.Fatalf("Load: %v", err)
	}
	if cfg.TxFromEmail != "hello@kumbuild.com" || cfg.PromoFromEmail != "hello@kumbuild.com" {
		t.Fatalf("tx/promo from must fall back to MAIL_FROM_*: %q / %q", cfg.TxFromEmail, cfg.PromoFromEmail)
	}
	setEnv(t, "MAIL_TX_FROM_EMAIL", "tx@kumbuild.com")
	cfg, err = Load()
	if err != nil {
		t.Fatalf("Load: %v", err)
	}
	if cfg.TxFromEmail != "tx@kumbuild.com" || cfg.PromoFromEmail != "hello@kumbuild.com" {
		t.Fatalf("explicit tx from not honored: %q / %q", cfg.TxFromEmail, cfg.PromoFromEmail)
	}
}

func TestLoadAllowedOriginsOverride(t *testing.T) {
	setEnv(t, "DATABASE_URL", "postgres://localhost/test")
	setEnv(t, "BREVO_API_KEY", "key-123")
	setEnv(t, "TURNSTILE_SECRET_KEY", "secret-123")
	setEnv(t, "ALLOWED_ORIGINS", "https://a.example.com, https://b.example.com ")
	cfg, err := Load()
	if err != nil {
		t.Fatalf("Load: %v", err)
	}
	if len(cfg.AllowedOrigins) != 2 || cfg.AllowedOrigins[0] != "https://a.example.com" {
		t.Fatalf("origins override: %v", cfg.AllowedOrigins)
	}
}

func contains(s, sub string) bool {
	for i := 0; i+len(sub) <= len(s); i++ {
		if s[i:i+len(sub)] == sub {
			return true
		}
	}
	return false
}
