// Package config loads the backend's environment configuration.
//
// Required variables cause Load to fail loudly at startup — a missing
// DATABASE_URL or TURNSTILE_SECRET_KEY must never silently become an empty
// string in production. Argon2 parameters are compile-time constants in
// internal/auth, not env vars (see backend/README.md §6).
package config

import (
	"fmt"
	"os"
	"strconv"
	"strings"
)

// DefaultAllowedOrigins is the dev CORS allow-list: the seven Cloudflare
// Pages frontends (backend/README.md §3.1) plus local dev servers.
var DefaultAllowedOrigins = []string{
	"https://kumbuild-web.pages.dev",
	"https://kumbuild-account.pages.dev",
	"https://kumbuild-admin.pages.dev",
	"https://kumbuild-home.pages.dev",
	"https://kumbuild-blog.pages.dev",
	"https://kumbuild-docs.pages.dev",
	"https://kumbuild-app.pages.dev",
	"http://localhost:5173",
	"http://localhost:3000",
}

// Config holds every environment-driven setting for the API.
type Config struct {
	// Env is "dev" or "prod". It drives cookie SameSite/Domain defaults.
	Env  string
	Port int

	DatabaseURL string

	RedisAddr     string
	RedisPassword string

	// Brevo (transactional + promotional email). The provider is Brevo;
	// no other email provider is wired in.
	BrevoAPIKey string

	// MailerAPIBaseURL overrides the Brevo API base URL. Production must
	// leave this at the default (https://api.brevo.com/v3); local testing
	// points it at a fake Brevo server. Never point it at an untrusted
	// host while a real API key is configured.
	MailerAPIBaseURL string

	// Mail identities. Tx/Promo fall back to the generic MAIL_FROM_* pair.
	MailFromEmail  string
	MailFromName   string
	TxFromEmail    string
	TxFromName     string
	PromoFromEmail string
	PromoFromName  string

	AppBaseURL string

	TurnstileSecretKey string

	// CookieDomain is "" in dev and ".kumbuild.com" in prod.
	CookieDomain string

	AllowedOrigins []string
}

// IsProd reports whether the app runs in production mode.
func (c *Config) IsProd() bool { return c.Env == "prod" }

// Load reads the environment and returns a Config, or an error listing
// every missing required variable.
func Load() (*Config, error) {
	cfg := &Config{
		Env:                envOr("APP_ENV", "dev"),
		Port:               envIntOr("PORT", 8080),
		DatabaseURL:        os.Getenv("DATABASE_URL"),
		RedisAddr:          envOr("REDIS_ADDR", "localhost:6379"),
		RedisPassword:      os.Getenv("REDIS_PASSWORD"),
		BrevoAPIKey:        os.Getenv("BREVO_API_KEY"),
		MailerAPIBaseURL:   envOr("MAILER_API_BASE_URL", "https://api.brevo.com/v3"),
		MailFromEmail:      os.Getenv("MAIL_FROM_EMAIL"),
		MailFromName:       envOr("MAIL_FROM_NAME", "Kumbuild"),
		AppBaseURL:         envOr("APP_BASE_URL", "http://localhost:8080"),
		TurnstileSecretKey: os.Getenv("TURNSTILE_SECRET_KEY"),
	}

	cfg.TxFromEmail = envOr("MAIL_TX_FROM_EMAIL", cfg.MailFromEmail)
	cfg.TxFromName = envOr("MAIL_TX_FROM_NAME", cfg.MailFromName)
	cfg.PromoFromEmail = envOr("MAIL_PROMO_FROM_EMAIL", cfg.MailFromEmail)
	cfg.PromoFromName = envOr("MAIL_PROMO_FROM_NAME", cfg.MailFromName)

	if domain := os.Getenv("COOKIE_DOMAIN"); domain != "" {
		cfg.CookieDomain = domain
	} else if cfg.IsProd() {
		cfg.CookieDomain = ".kumbuild.com"
	}

	if raw := os.Getenv("ALLOWED_ORIGINS"); raw != "" {
		cfg.AllowedOrigins = splitCSV(raw)
	} else {
		cfg.AllowedOrigins = append([]string(nil), DefaultAllowedOrigins...)
	}

	var missing []string
	if cfg.DatabaseURL == "" {
		missing = append(missing, "DATABASE_URL")
	}
	if cfg.BrevoAPIKey == "" {
		missing = append(missing, "BREVO_API_KEY")
	}
	if cfg.TurnstileSecretKey == "" {
		missing = append(missing, "TURNSTILE_SECRET_KEY")
	}
	if len(missing) > 0 {
		return nil, fmt.Errorf("missing required environment variables: %s", strings.Join(missing, ", "))
	}
	return cfg, nil
}

func envOr(key, def string) string {
	if v := strings.TrimSpace(os.Getenv(key)); v != "" {
		return v
	}
	return def
}

func envIntOr(key string, def int) int {
	if v := strings.TrimSpace(os.Getenv(key)); v != "" {
		if n, err := strconv.Atoi(v); err == nil {
			return n
		}
	}
	return def
}

func splitCSV(s string) []string {
	parts := strings.Split(s, ",")
	out := make([]string, 0, len(parts))
	for _, p := range parts {
		if p = strings.TrimSpace(p); p != "" {
			out = append(out, p)
		}
	}
	return out
}
