package db_test

import (
	"context"
	"testing"

	"github.com/dusmamud/kumbuild/backend/internal/db"
	"github.com/dusmamud/kumbuild/backend/internal/testutil"
)

func TestMigrateAppliesAndIsIdempotent(t *testing.T) {
	pool := testutil.SetupTestDB(t)
	defer pool.Close()
	ctx := context.Background()

	// Migrate runs again cleanly (SetupTestDB already migrated once).
	if err := db.Migrate(ctx, pool); err != nil {
		t.Fatalf("second Migrate: %v", err)
	}
	if err := db.Migrate(ctx, pool); err != nil {
		t.Fatalf("third Migrate: %v", err)
	}

	var version int
	if err := pool.QueryRow(ctx,
		`SELECT version FROM schema_migrations ORDER BY version`).Scan(&version); err != nil {
		t.Fatalf("schema_migrations read: %v", err)
	}
	if version != 1 {
		t.Fatalf("schema version: got %d, want 1", version)
	}

	// Every table from 0001 exists.
	for _, table := range []string{"users", "billing_addresses", "sessions",
		"auth_tokens", "audit_logs", "order_notes", "email_outbox"} {
		var exists bool
		if err := pool.QueryRow(ctx,
			`SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = $1)`,
			table).Scan(&exists); err != nil || !exists {
			t.Fatalf("table %s missing: exists=%v err=%v", table, exists, err)
		}
	}

	// Enums exist with the right values.
	var roles []string
	rows, err := pool.Query(ctx,
		`SELECT enumlabel FROM pg_enum JOIN pg_type ON pg_enum.enumtypid = pg_type.oid
		 WHERE pg_type.typname = 'user_role' ORDER BY enumsortorder`)
	if err != nil {
		t.Fatalf("enum query: %v", err)
	}
	defer rows.Close()
	for rows.Next() {
		var v string
		_ = rows.Scan(&v)
		roles = append(roles, v)
	}
	want := "super_admin admin customer_service customer"
	got := ""
	for i, r := range roles {
		if i > 0 {
			got += " "
		}
		got += r
	}
	if got != want {
		t.Fatalf("user_role enum: got %q, want %q", got, want)
	}
}

func TestConnectBadURL(t *testing.T) {
	if _, err := db.Connect(context.Background(), "://bad url"); err == nil {
		t.Fatal("Connect must fail on a malformed DATABASE_URL")
	}
	// Unreachable host must fail fast-ish (ping), not hang forever.
	ctx := context.Background()
	if _, err := db.Connect(ctx, "postgres://u:p@127.0.0.1:1/db?connect_timeout=2"); err == nil {
		t.Fatal("Connect must fail on an unreachable host")
	}
}
