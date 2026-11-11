// Package server wires the chi router: public probes, the /api/auth and
// /api/admin route trees, and the auth/role/CSRF middleware around them.
package server

import (
	"net/http"

	"github.com/dusmamud/kumbuild/backend/internal/config"
	"github.com/dusmamud/kumbuild/backend/internal/handlers"
	"github.com/dusmamud/kumbuild/backend/internal/mailer"
	"github.com/dusmamud/kumbuild/backend/internal/middleware"
	"github.com/dusmamud/kumbuild/backend/internal/ratelimit"
	"github.com/dusmamud/kumbuild/backend/internal/store"
	"github.com/dusmamud/kumbuild/backend/internal/turnstile"
	"github.com/go-chi/chi/v5"
	chimw "github.com/go-chi/chi/v5/middleware"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"
)

// Deps is everything the HTTP layer needs. Outbox is owned by the Mailer
// (the handlers never touch it directly); Pool/Redis exist for /readyz.
type Deps struct {
	Cfg       *config.Config
	Pool      *pgxpool.Pool
	Redis     *redis.Client
	Users     store.UserStore
	Billing   store.BillingStore
	Sessions  store.SessionStore
	Tokens    store.TokenStore
	Audit     store.AuditStore
	Notes     store.NoteStore
	Outbox    store.OutboxStore
	Mailer    mailer.Mailer
	Turnstile turnstile.Verifier
	Limiter   *ratelimit.Limiter
	Auth      *middleware.Authenticator
}

// New builds the HTTP handler.
//
// /healthz and /readyz are public. Everything under /api is CSRF-checked
// on state-changing methods (GET skips per the middleware); login/signup
// included — the frontend GETs /api/auth/csrf first for a token.
// /api/admin/* is behind RequireAuth, with per-route RequireRole — except
// POST /admin/users, whose role check lives inside the handler.
func New(d Deps) http.Handler {
	h := &handlers.Handler{
		Cfg:       d.Cfg,
		Users:     d.Users,
		Billing:   d.Billing,
		Sessions:  d.Sessions,
		Tokens:    d.Tokens,
		Audit:     d.Audit,
		Notes:     d.Notes,
		Mailer:    d.Mailer,
		Turnstile: d.Turnstile,
		Limiter:   d.Limiter,
	}
	health := &handlers.Health{Pool: d.Pool, Redis: d.Redis}
	auth := d.Auth

	r := chi.NewRouter()
	r.Use(chimw.Recoverer)
	r.Use(middleware.CORS(d.Cfg))
	r.Get("/healthz", health.Healthz)
	r.Get("/readyz", health.Readyz)

	r.Route("/api", func(r chi.Router) {
		r.Use(middleware.RequireCSRF(d.Cfg))
		r.Get("/auth/csrf", h.CSRFToken)
		r.Route("/auth", func(r chi.Router) {
			r.Post("/signup", h.Signup)
			r.Post("/verify-email", h.VerifyEmail)
			r.Post("/resend-otp", h.ResendOTP)
			r.Post("/login", h.Login)
			r.Post("/forgot-password", h.ForgotPassword)
			r.Post("/reset-password", h.ResetPassword)
			r.Post("/accept-invite", h.AcceptInvite)
			r.With(middleware.RequireAuth(auth)).Post("/logout", h.Logout)
			r.With(middleware.RequireAuth(auth)).Get("/me", h.Me)
			r.With(middleware.RequireAuth(auth)).Post("/change-password", h.ChangePassword)
		})
		r.Route("/admin", func(r chi.Router) {
			r.Use(middleware.RequireAuth(auth))
			sa := middleware.RequireRole(store.RoleSuperAdmin)
			r.With(sa).Get("/users", h.ListUsers)
			r.Post("/users", h.CreateUser) // role check inside the handler
			r.With(sa).Get("/users/{id}", h.GetUser)
			r.With(sa).Patch("/users/{id}/role", h.ChangeUserRole)
			r.With(sa).Patch("/users/{id}/status", h.ChangeUserStatus)
			r.With(sa).Post("/users/{id}/reset-password", h.ResetUserPassword)
			r.With(sa).Post("/users/{id}/resend-invite", h.ResendInvite)
			r.With(sa).Get("/audit-logs", h.ListAuditLogs)
			staff := middleware.RequireRole(store.RoleAdmin, store.RoleCustomerService, store.RoleSuperAdmin)
			r.With(staff).Post("/orders/{id}/notes", h.CreateOrderNote)
			r.With(staff).Get("/orders/{id}/notes", h.ListOrderNotes)
		})
	})
	return r
}
