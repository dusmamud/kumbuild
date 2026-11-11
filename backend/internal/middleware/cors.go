// CORS implements cross-origin access for the browser frontends
// (backend/README.md §3.1): only allow-listed origins get
// Access-Control-Allow-Origin, always with credentials. A preflight
// (OPTIONS + Access-Control-Request-Method) is answered 204 directly.
// A request from a non-allow-listed origin gets no CORS headers, so the
// browser blocks reading the response. A request with no Origin header
// (curl, server-to-server) passes through untouched.
package middleware

import (
	"net/http"

	"github.com/dusmamud/kumbuild/backend/internal/config"
)

// CORS returns middleware enforcing the configured origin allow-list.
func CORS(cfg *config.Config) func(http.Handler) http.Handler {
	allowed := map[string]bool{}
	for _, o := range cfg.AllowedOrigins {
		allowed[o] = true
	}
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			origin := r.Header.Get("Origin")
			if origin != "" {
				w.Header().Set("Vary", "Origin")
				if allowed[origin] {
					w.Header().Set("Access-Control-Allow-Origin", origin)
					w.Header().Set("Access-Control-Allow-Credentials", "true")
					if r.Method == http.MethodOptions && r.Header.Get("Access-Control-Request-Method") != "" {
						w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PATCH, PUT, DELETE, OPTIONS")
						w.Header().Set("Access-Control-Allow-Headers", "Content-Type, X-CSRF-Token, Authorization")
						w.Header().Set("Access-Control-Max-Age", "86400")
						w.WriteHeader(http.StatusNoContent)
						return
					}
				}
			}
			next.ServeHTTP(w, r)
		})
	}
}
