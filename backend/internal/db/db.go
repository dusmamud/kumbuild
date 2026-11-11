// Package db owns the Postgres connection pool and the migration runner.
package db

import (
	"context"
	"fmt"
	"io/fs"
	"sort"
	"strings"

	"github.com/dusmamud/kumbuild/backend/migrations"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Connect opens a pgxpool with MaxConns 10 (tuned for the 1GB VPS:
// Postgres max_connections is 30 — the pool must stay well under it).
func Connect(ctx context.Context, databaseURL string) (*pgxpool.Pool, error) {
	cfg, err := pgxpool.ParseConfig(databaseURL)
	if err != nil {
		return nil, fmt.Errorf("parse DATABASE_URL: %w", err)
	}
	cfg.MaxConns = 10
	pool, err := pgxpool.NewWithConfig(ctx, cfg)
	if err != nil {
		return nil, fmt.Errorf("create pool: %w", err)
	}
	if err := pool.Ping(ctx); err != nil {
		pool.Close()
		return nil, fmt.Errorf("ping database: %w", err)
	}
	return pool, nil
}

// Migrate applies every embedded migration in filename order, one
// transaction per file, skipping versions already recorded in
// schema_migrations. Safe to run on every startup.
func Migrate(ctx context.Context, pool *pgxpool.Pool) error {
	if _, err := pool.Exec(ctx, `CREATE TABLE IF NOT EXISTS schema_migrations (
		version    int PRIMARY KEY,
		applied_at timestamptz NOT NULL DEFAULT now()
	)`); err != nil {
		return fmt.Errorf("create schema_migrations: %w", err)
	}

	entries, err := fs.ReadDir(migrations.FS, ".")
	if err != nil {
		return fmt.Errorf("read embedded migrations: %w", err)
	}
	names := make([]string, 0, len(entries))
	for _, e := range entries {
		if !e.IsDir() && strings.HasSuffix(e.Name(), ".sql") {
			names = append(names, e.Name())
		}
	}
	sort.Strings(names)

	for _, name := range names {
		var version int
		if _, err := fmt.Sscanf(name, "%04d_", &version); err != nil {
			return fmt.Errorf("migration %q has no numeric version prefix: %w", name, err)
		}

		var exists bool
		if err := pool.QueryRow(ctx,
			`SELECT EXISTS (SELECT 1 FROM schema_migrations WHERE version = $1)`, version,
		).Scan(&exists); err != nil {
			return fmt.Errorf("check migration %d: %w", version, err)
		}
		if exists {
			continue
		}

		sql, err := fs.ReadFile(migrations.FS, name)
		if err != nil {
			return fmt.Errorf("read migration %s: %w", name, err)
		}
		tx, err := pool.Begin(ctx)
		if err != nil {
			return fmt.Errorf("begin migration %d: %w", version, err)
		}
		if _, err := tx.Exec(ctx, string(sql)); err != nil {
			_ = tx.Rollback(ctx)
			return fmt.Errorf("apply migration %s: %w", name, err)
		}
		if _, err := tx.Exec(ctx,
			`INSERT INTO schema_migrations (version) VALUES ($1)`, version); err != nil {
			_ = tx.Rollback(ctx)
			return fmt.Errorf("record migration %d: %w", version, err)
		}
		if err := tx.Commit(ctx); err != nil {
			return fmt.Errorf("commit migration %d: %w", version, err)
		}
	}
	return nil
}

// Close releases the pool.
func Close(pool *pgxpool.Pool) {
	if pool != nil {
		pool.Close()
	}
}
