// Package seed creates the one and only super_admin (the owner, Dus).
// It is used by the cmd/seed-admin CLI only — there is no HTTP endpoint
// that can create a super_admin (backend/README.md §5, AUTH_PLAN.md §10).
// Prompting lives in the CLI; this package takes plain values and enforces
// every rule itself so a weak password or a second super_admin can never
// slip through via a different caller.
package seed

import (
	"context"
	"errors"
	"fmt"
	"sort"
	"strings"
	"time"

	"github.com/dusmamud/kumbuild/backend/internal/auth"
	"github.com/dusmamud/kumbuild/backend/internal/store"
)

// ErrSuperAdminExists is returned when a super_admin already exists.
// Seeding must abort in that case — exactly ONE super_admin ever exists.
var ErrSuperAdminExists = errors.New("a super_admin already exists")

// PasswordHasher hashes a password the same way the auth package does.
// It is a function type so callers pass auth.HashPassword directly —
// there is exactly one hashing implementation in the codebase.
type PasswordHasher func(password string) (string, error)

// SeedSuperAdmin validates the inputs, aborts if a super_admin already
// exists, and creates the owner account: role super_admin, status active,
// email_verified_at set (the owner is verified by definition), no billing
// address (staff never get one). The returned user is re-read from the
// database so EmailVerifiedAt is populated.
func SeedSuperAdmin(ctx context.Context, users store.UserStore, hash PasswordHasher, email, fullName, phoneNo, whatsAppNo, password string) (*store.User, error) {
	email = strings.TrimSpace(email)
	fullName = strings.TrimSpace(fullName)
	phoneNo = strings.TrimSpace(phoneNo)
	whatsAppNo = strings.TrimSpace(whatsAppNo)
	if whatsAppNo == "" {
		whatsAppNo = phoneNo // "same as phone"
	}

	// Validate with the foundation's single validator: email, full name,
	// password policy, Indian phone (E.164 +91) and WhatsApp (E.164).
	// The password-policy check lives here, not only in the CLI prompts,
	// so a direct caller cannot seed a weak password.
	if errs := auth.ValidateSignupInput(auth.SignupInput{
		FullName:   fullName,
		Email:      email,
		Password:   password,
		PhoneNo:    phoneNo,
		WhatsAppNo: whatsAppNo,
	}); len(errs) > 0 {
		fields := make([]string, 0, len(errs))
		for f := range errs {
			fields = append(fields, f)
		}
		sort.Strings(fields)
		parts := make([]string, 0, len(fields))
		for _, f := range fields {
			parts = append(parts, f+": "+errs[f])
		}
		return nil, fmt.Errorf("invalid input: %s", strings.Join(parts, ", "))
	}

	n, err := users.CountSuperAdmins(ctx)
	if err != nil {
		return nil, fmt.Errorf("count super_admins: %w", err)
	}
	if n > 0 {
		return nil, ErrSuperAdminExists
	}

	if hash == nil {
		return nil, errors.New("password hasher is required")
	}
	hashStr, err := hash(password)
	if err != nil {
		return nil, fmt.Errorf("hash password: %w", err)
	}

	u := &store.User{
		FullName:   fullName,
		Email:      email,
		PhoneNo:    phoneNo,
		WhatsAppNo: whatsAppNo,
		Role:       store.RoleSuperAdmin,
		Status:     store.StatusActive,
	}
	// No billing address (nil) — staff never get one.
	if err := users.Create(ctx, u, hashStr, nil); err != nil {
		return nil, fmt.Errorf("create super_admin: %w", err)
	}

	// Create() does not stamp email_verified_at, so set it explicitly.
	// SetEmailVerified only flips pending -> active, so our already-active
	// user keeps its status and just gains the timestamp.
	if err := users.SetEmailVerified(ctx, u.ID); err != nil {
		return nil, fmt.Errorf("mark email verified: %w", err)
	}
	created, err := users.GetByID(ctx, u.ID)
	if err != nil {
		return nil, fmt.Errorf("read created super_admin: %w", err)
	}
	if created.EmailVerifiedAt == nil || created.EmailVerifiedAt.IsZero() {
		return nil, fmt.Errorf("seeded super_admin has no email_verified_at (now=%s)", time.Now().Format(time.RFC3339))
	}
	return created, nil
}
