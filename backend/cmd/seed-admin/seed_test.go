// Tests for the seed-admin CLI's core: seed.SeedSuperAdmin against the
// real test DB (migrate + truncate via testutil). The CLI's prompting is
// deliberately NOT tested here — readPasswordTwice needs a TTY — but the
// policy check it relies on lives in SeedSuperAdmin, so the weak-password
// case below exercises the same rule.
package main

import (
	"context"
	"errors"
	"testing"

	"github.com/dusmamud/kumbuild/backend/internal/auth"
	"github.com/dusmamud/kumbuild/backend/internal/seed"
	"github.com/dusmamud/kumbuild/backend/internal/store"
	"github.com/dusmamud/kumbuild/backend/internal/testutil"
)

const (
	testEmail    = "dus@example.com"
	testFullName = "Dus Mamud"
	testPhone    = "+919876543210"
	testPassword = "Str0ng!Pass"
)

func setupUsers(t *testing.T) (context.Context, store.UserStore) {
	t.Helper()
	pool := testutil.SetupTestDB(t)
	t.Cleanup(pool.Close)
	return context.Background(), store.NewPGUserStore(pool)
}

// Seed once: role super_admin, status active, email verified.
func TestSeedOnceOK(t *testing.T) {
	ctx, users := setupUsers(t)

	u, err := seed.SeedSuperAdmin(ctx, users, auth.HashPassword, testEmail, testFullName, testPhone, "", testPassword)
	if err != nil {
		t.Fatalf("SeedSuperAdmin: %v", err)
	}
	if u.Role != store.RoleSuperAdmin {
		t.Errorf("role = %q, want %q", u.Role, store.RoleSuperAdmin)
	}
	if u.Status != store.StatusActive {
		t.Errorf("status = %q, want %q", u.Status, store.StatusActive)
	}
	if u.EmailVerifiedAt == nil || u.EmailVerifiedAt.IsZero() {
		t.Errorf("email_verified_at not set: %v", u.EmailVerifiedAt)
	}
	if u.ID == "" || u.Email != testEmail || u.FullName != testFullName {
		t.Errorf("created user fields wrong: %+v", u)
	}
	if u.PhoneNo != testPhone || u.WhatsAppNo != testPhone {
		t.Errorf("phone/whatsapp = %q/%q, want %q (whatsapp defaults to phone)", u.PhoneNo, u.WhatsAppNo, testPhone)
	}
	// The stored hash must verify against the password actually passed.
	if ok, err := auth.VerifyPassword(testPassword, u.PasswordHash); err != nil || !ok {
		t.Errorf("stored hash does not verify: ok=%v err=%v", ok, err)
	}
	// No billing address for staff: the seed passes nil billing.
	if n, err := users.CountSuperAdmins(ctx); err != nil || n != 1 {
		t.Errorf("CountSuperAdmins = %d, err = %v, want 1", n, err)
	}
}

// Seed twice: the second call must abort — exactly ONE super_admin.
func TestSeedTwiceErrors(t *testing.T) {
	ctx, users := setupUsers(t)

	if _, err := seed.SeedSuperAdmin(ctx, users, auth.HashPassword, testEmail, testFullName, testPhone, "", testPassword); err != nil {
		t.Fatalf("first SeedSuperAdmin: %v", err)
	}
	_, err := seed.SeedSuperAdmin(ctx, users, auth.HashPassword, "other@example.com", "Other Person", "+919876543211", "", "An0ther!Pass")
	if !errors.Is(err, seed.ErrSuperAdminExists) {
		t.Fatalf("second seed: err = %v, want ErrSuperAdminExists (%q)", err, seed.ErrSuperAdminExists)
	}
	// Still exactly one super_admin, and the second email was never created.
	if n, err := users.CountSuperAdmins(ctx); err != nil || n != 1 {
		t.Errorf("CountSuperAdmins after second seed = %d, err = %v, want 1", n, err)
	}
	if exists, err := users.ExistsByEmail(ctx, "other@example.com"); err != nil || exists {
		t.Errorf("second email must not exist: exists=%v err=%v", exists, err)
	}
}

// Invalid phone (not E.164 India) must fail — before any account is made.
func TestSeedInvalidPhoneErrors(t *testing.T) {
	ctx, users := setupUsers(t)

	for _, bad := range []string{"987654321", "+911234567890", "+14155552671", ""} {
		_, err := seed.SeedSuperAdmin(ctx, users, auth.HashPassword, testEmail, testFullName, bad, "", testPassword)
		if err == nil {
			t.Errorf("phone %q: expected error, got nil", bad)
		}
	}
	if n, err := users.CountSuperAdmins(ctx); err != nil || n != 0 {
		t.Errorf("CountSuperAdmins after invalid phones = %d, err = %v, want 0", n, err)
	}
}

// Weak password must fail HERE — the policy check lives in
// SeedSuperAdmin, not only in the CLI's hidden prompts.
func TestSeedWeakPasswordErrors(t *testing.T) {
	ctx, users := setupUsers(t)

	for _, weak := range []string{"short1!", "abcdef1!", "ABCDEF1!", "Abcdefg!", "Abcdef12", ""} {
		_, err := seed.SeedSuperAdmin(ctx, users, auth.HashPassword, testEmail, testFullName, testPhone, "", weak)
		if err == nil {
			t.Errorf("password %q: expected error, got nil", weak)
		}
	}
	if n, err := users.CountSuperAdmins(ctx); err != nil || n != 0 {
		t.Errorf("CountSuperAdmins after weak passwords = %d, err = %v, want 0", n, err)
	}
}

// Invalid email must fail too.
func TestSeedInvalidEmailErrors(t *testing.T) {
	ctx, users := setupUsers(t)

	_, err := seed.SeedSuperAdmin(ctx, users, auth.HashPassword, "not-an-email", testFullName, testPhone, "", testPassword)
	if err == nil {
		t.Fatal("invalid email: expected error, got nil")
	}
}
