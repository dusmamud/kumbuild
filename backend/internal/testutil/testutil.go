// Package testutil shares the test-database setup between packages.
// It connects to the test DB (TEST_DATABASE_URL or the local default),
// runs migrations, and truncates all app tables so each test starts clean.
// If the test DB is unreachable the test is skipped with a clear message —
// never faked.
package testutil

import (
	"context"
	"os"
	"testing"

	"github.com/dusmamud/kumbuild/backend/internal/db"
	"github.com/jackc/pgx/v5/pgxpool"
)

// TestDatabaseURL returns the test DB URL.
func TestDatabaseURL() string {
	if v := os.Getenv("TEST_DATABASE_URL"); v != "" {
		return v
	}
	return "postgres://kumbuild:kumbuild@localhost:5432/kumbuild_test"
}

// SetupTestDB connects, migrates and truncates. Skips the test if the DB
// is unreachable.
func SetupTestDB(t *testing.T) *pgxpool.Pool {
	t.Helper()
	ctx := context.Background()
	pool, err := db.Connect(ctx, TestDatabaseURL())
	if err != nil {
		t.Skipf("test database unreachable (%s): %v", TestDatabaseURL(), err)
	}
	if err := db.Migrate(ctx, pool); err != nil {
		pool.Close()
		t.Fatalf("migrate test database: %v", err)
	}
	Truncate(t, pool)
	return pool
}

// Truncate wipes all app tables (schema_migrations is kept).
func Truncate(t *testing.T, pool *pgxpool.Pool) {
	t.Helper()
	_, err := pool.Exec(context.Background(), `TRUNCATE
		email_outbox, order_notes, audit_logs, auth_tokens,
		sessions, billing_addresses, users
		RESTART IDENTITY CASCADE`)
	if err != nil {
		t.Fatalf("truncate test tables: %v", err)
	}
}
