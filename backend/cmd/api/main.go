// Command api runs the Kumbuild backend HTTP API.
package main

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/dusmamud/kumbuild/backend/internal/config"
	"github.com/dusmamud/kumbuild/backend/internal/db"
	"github.com/dusmamud/kumbuild/backend/internal/mailer"
	"github.com/dusmamud/kumbuild/backend/internal/middleware"
	"github.com/dusmamud/kumbuild/backend/internal/ratelimit"
	"github.com/dusmamud/kumbuild/backend/internal/server"
	"github.com/dusmamud/kumbuild/backend/internal/store"
	"github.com/dusmamud/kumbuild/backend/internal/turnstile"
	"github.com/redis/go-redis/v9"
)

func main() {
	if err := run(); err != nil {
		slog.Error("api: fatal", "error", err)
		os.Exit(1)
	}
}

func run() error {
	cfg, err := config.Load()
	if err != nil {
		return fmt.Errorf("load config: %w", err)
	}

	ctx := context.Background()
	pool, err := db.Connect(ctx, cfg.DatabaseURL)
	if err != nil {
		return fmt.Errorf("connect database: %w", err)
	}
	defer pool.Close()
	if err := db.Migrate(ctx, pool); err != nil {
		return fmt.Errorf("run migrations: %w", err)
	}
	slog.Info("api: database connected")

	rdb := redis.NewClient(&redis.Options{
		Addr:     cfg.RedisAddr,
		Password: cfg.RedisPassword,
		DB:       0,
	})
	defer func() { _ = rdb.Close() }()
	if err := rdb.Ping(ctx).Err(); err != nil {
		return fmt.Errorf("connect redis: %w", err)
	}
	slog.Info("api: redis connected")

	users := store.NewPGUserStore(pool)
	sessions := store.NewPGSessionStore(pool)
	tokens := store.NewPGTokenStore(pool)
	audit := store.NewPGAuditStore(pool)
	notes := store.NewPGNoteStore(pool)
	outbox := store.NewPGOutboxStore(pool)
	m := mailer.NewBrevoMailer(cfg, outbox)
	verifier := turnstile.NewHTTPVerifier(cfg)
	limiter := ratelimit.NewWithClient(rdb)
	authn := &middleware.Authenticator{Users: users, Sessions: sessions}

	handler := server.New(server.Deps{
		Cfg: cfg, Pool: pool, Redis: rdb,
		Users: users, Billing: users, Sessions: sessions, Tokens: tokens,
		Audit: audit, Notes: notes, Outbox: outbox,
		Mailer: m, Turnstile: verifier, Limiter: limiter, Auth: authn,
	})

	// Mail reaper: retries failed transactional outbox rows every 60s.
	reaperCtx, stopReaper := context.WithCancel(context.Background())
	defer stopReaper()
	mailer.StartReaper(reaperCtx, outbox, m, mailer.ReaperInterval)

	srv := &http.Server{
		Addr:              fmt.Sprintf(":%d", cfg.Port),
		Handler:           handler,
		ReadHeaderTimeout: 10 * time.Second,
	}

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, os.Interrupt, syscall.SIGTERM)
	go func() {
		<-stop
		slog.Info("api: shutting down")
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		_ = srv.Shutdown(shutdownCtx)
	}()

	slog.Info("api: starting", "env", cfg.Env, "port", cfg.Port)
	if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
		return fmt.Errorf("serve: %w", err)
	}
	return nil
}
