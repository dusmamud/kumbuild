package handlers

import (
	"net/http"

	"github.com/dusmamud/kumbuild/backend/internal/middleware"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"
)

// Health holds the liveness/readiness dependencies. The stores hide the
// pool/client behind interfaces with no Ping, so the raw handles live here.
type Health struct {
	Pool  *pgxpool.Pool
	Redis *redis.Client
}

// Healthz is the liveness probe (no auth, no dependencies).
func (hh *Health) Healthz(w http.ResponseWriter, r *http.Request) {
	middleware.WriteJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

// Readyz is the readiness probe: DB ping + Redis ping. 200 "ready", or
// 503 "not-ready" when either dependency is down.
func (hh *Health) Readyz(w http.ResponseWriter, r *http.Request) {
	ok := hh.Pool != nil && hh.Redis != nil
	if ok {
		if err := hh.Pool.Ping(r.Context()); err != nil {
			ok = false
		}
	}
	if ok {
		if err := hh.Redis.Ping(r.Context()).Err(); err != nil {
			ok = false
		}
	}
	if !ok {
		middleware.WriteJSON(w, http.StatusServiceUnavailable, map[string]string{"status": "not-ready"})
		return
	}
	middleware.WriteJSON(w, http.StatusOK, map[string]string{"status": "ready"})
}
