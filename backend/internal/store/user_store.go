package store

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// UserStore is the interface handlers use for user + billing data.
type UserStore interface {
	Create(ctx context.Context, u *User, passwordHash string, billing *BillingAddress) error
	GetByID(ctx context.Context, id string) (*User, error)
	GetByEmail(ctx context.Context, email string) (*User, error)
	List(ctx context.Context, role, status, q string, limit, offset int) ([]*User, int, error)
	UpdateRole(ctx context.Context, id, role string) error
	UpdateStatus(ctx context.Context, id, status string) error
	UpdatePasswordHash(ctx context.Context, id, hash string) error
	SetEmailVerified(ctx context.Context, id string) error
	CountSuperAdmins(ctx context.Context) (int, error)
	ExistsByEmail(ctx context.Context, email string) (bool, error)
}

// BillingStore reads/writes the customer-only billing address.
type BillingStore interface {
	Upsert(ctx context.Context, b *BillingAddress) error
	GetByUserID(ctx context.Context, userID string) (*BillingAddress, error)
}

var errNotFound = errors.New("not found")

// ErrNotFound is returned when a row does not exist.
func ErrNotFound() error { return errNotFound }

// PGUserStore is the pgx implementation of UserStore + BillingStore.
type PGUserStore struct{ pool *pgxpool.Pool }

// NewPGUserStore returns a UserStore/BillingStore backed by pool.
func NewPGUserStore(pool *pgxpool.Pool) *PGUserStore { return &PGUserStore{pool: pool} }

func scanUser(row pgx.Row) (*User, error) {
	var u User
	err := row.Scan(
		&u.ID, &u.FullName, &u.Email, &u.PasswordHash, &u.PhoneNo,
		&u.WhatsAppNo, &u.AlternativeEmail, &u.Role, &u.Status,
		&u.EmailVerifiedAt, &u.CreatedAt, &u.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, errNotFound
		}
		return nil, err
	}
	return &u, nil
}

const userColumns = `id, full_name, email, password_hash, phone_no, whatsapp_no,
	alternative_email, role, status, email_verified_at, created_at, updated_at`

// Create inserts the user and, when billing != nil, the billing address in
// ONE transaction. alternative_email is stored NULL when empty.
func (s *PGUserStore) Create(ctx context.Context, u *User, passwordHash string, billing *BillingAddress) error {
	var altEmail any
	if u.AlternativeEmail != nil && strings.TrimSpace(*u.AlternativeEmail) != "" {
		altEmail = strings.TrimSpace(*u.AlternativeEmail)
	}
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	err = tx.QueryRow(ctx, `INSERT INTO users
		(full_name, email, password_hash, phone_no, whatsapp_no, alternative_email, role, status)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		RETURNING `+userColumns,
		u.FullName, u.Email, passwordHash, u.PhoneNo, u.WhatsAppNo, altEmail, u.Role, u.Status,
	).Scan(
		&u.ID, &u.FullName, &u.Email, &u.PasswordHash, &u.PhoneNo,
		&u.WhatsAppNo, &u.AlternativeEmail, &u.Role, &u.Status,
		&u.EmailVerifiedAt, &u.CreatedAt, &u.UpdatedAt,
	)
	if err != nil {
		return fmt.Errorf("insert user: %w", err)
	}

	if billing != nil {
		billing.UserID = u.ID
		if err := insertBilling(ctx, tx, billing); err != nil {
			return err
		}
	}
	return tx.Commit(ctx)
}

func (s *PGUserStore) GetByID(ctx context.Context, id string) (*User, error) {
	return scanUser(s.pool.QueryRow(ctx,
		`SELECT `+userColumns+` FROM users WHERE id = $1`, id))
}

func (s *PGUserStore) GetByEmail(ctx context.Context, email string) (*User, error) {
	// citext makes this case-insensitive.
	return scanUser(s.pool.QueryRow(ctx,
		`SELECT `+userColumns+` FROM users WHERE email = $1`, email))
}

// List returns a page of users plus the total matching count. Empty role /
// status / q mean "no filter". q matches full_name, email or phone_no.
func (s *PGUserStore) List(ctx context.Context, role, status, q string, limit, offset int) ([]*User, int, error) {
	if limit <= 0 {
		limit = 20
	}
	if limit > 100 {
		limit = 100
	}
	if offset < 0 {
		offset = 0
	}
	var where []string
	var args []any
	if role != "" {
		args = append(args, role)
		where = append(where, fmt.Sprintf("role = $%d", len(args)))
	}
	if status != "" {
		args = append(args, status)
		where = append(where, fmt.Sprintf("status = $%d", len(args)))
	}
	if q = strings.TrimSpace(q); q != "" {
		args = append(args, "%"+q+"%")
		where = append(where, fmt.Sprintf("(full_name ILIKE $%d OR email::text ILIKE $%d OR phone_no ILIKE $%d)",
			len(args), len(args), len(args)))
	}
	whereSQL := ""
	if len(where) > 0 {
		whereSQL = "WHERE " + strings.Join(where, " AND ")
	}

	var total int
	if err := s.pool.QueryRow(ctx,
		`SELECT COUNT(*) FROM users `+whereSQL, args...).Scan(&total); err != nil {
		return nil, 0, err
	}

	rows, err := s.pool.Query(ctx,
		`SELECT `+userColumns+` FROM users `+whereSQL+` ORDER BY created_at DESC LIMIT $`+
			fmt.Sprint(len(args)+1)+` OFFSET $`+fmt.Sprint(len(args)+2),
		append(append([]any{}, args...), limit, offset)...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	users := []*User{}
	for rows.Next() {
		u, err := scanUser(rows)
		if err != nil {
			return nil, 0, err
		}
		users = append(users, u)
	}
	return users, total, rows.Err()
}

func (s *PGUserStore) UpdateRole(ctx context.Context, id, role string) error {
	tag, err := s.pool.Exec(ctx,
		`UPDATE users SET role = $1, updated_at = now() WHERE id = $2`, role, id)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return errNotFound
	}
	return nil
}

func (s *PGUserStore) UpdateStatus(ctx context.Context, id, status string) error {
	tag, err := s.pool.Exec(ctx,
		`UPDATE users SET status = $1, updated_at = now() WHERE id = $2`, status, id)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return errNotFound
	}
	return nil
}

func (s *PGUserStore) UpdatePasswordHash(ctx context.Context, id, hash string) error {
	tag, err := s.pool.Exec(ctx,
		`UPDATE users SET password_hash = $1, updated_at = now() WHERE id = $2`, hash, id)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return errNotFound
	}
	return nil
}

// SetEmailVerified stamps email_verified_at and flips pending -> active.
// Already-active users keep their status (invited users must NOT be
// flipped by this — accept-invite sets status explicitly).
func (s *PGUserStore) SetEmailVerified(ctx context.Context, id string) error {
	tag, err := s.pool.Exec(ctx,
		`UPDATE users SET email_verified_at = now(),
			status = CASE WHEN status = 'pending' THEN 'active' ELSE status END,
			updated_at = now()
		WHERE id = $1`, id)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return errNotFound
	}
	return nil
}

func (s *PGUserStore) CountSuperAdmins(ctx context.Context) (int, error) {
	var n int
	err := s.pool.QueryRow(ctx,
		`SELECT COUNT(*) FROM users WHERE role = 'super_admin'`).Scan(&n)
	return n, err
}

func (s *PGUserStore) ExistsByEmail(ctx context.Context, email string) (bool, error) {
	var exists bool
	err := s.pool.QueryRow(ctx,
		`SELECT EXISTS (SELECT 1 FROM users WHERE email = $1)`, email).Scan(&exists)
	return exists, err
}

// ---------------------------------------------------------------- billing

func scanBilling(row pgx.Row) (*BillingAddress, error) {
	var b BillingAddress
	err := row.Scan(
		&b.ID, &b.UserID, &b.BillingName, &b.AddressLine1, &b.AddressLine2,
		&b.City, &b.State, &b.Pincode, &b.Country, &b.GSTIN,
		&b.CreatedAt, &b.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, errNotFound
		}
		return nil, err
	}
	return &b, nil
}

const billingColumns = `id, user_id, billing_name, address_line1, address_line2,
	city, state, pincode, country, gstin, created_at, updated_at`

func insertBilling(ctx context.Context, tx pgx.Tx, b *BillingAddress) error {
	return tx.QueryRow(ctx, `INSERT INTO billing_addresses
		(user_id, billing_name, address_line1, address_line2, city, state, pincode, country, gstin)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
		RETURNING `+billingColumns,
		b.UserID, b.BillingName, b.AddressLine1, nullIfEmpty(b.AddressLine2),
		b.City, b.State, b.Pincode, b.Country, nullIfEmpty(b.GSTIN),
	).Scan(
		&b.ID, &b.UserID, &b.BillingName, &b.AddressLine1, &b.AddressLine2,
		&b.City, &b.State, &b.Pincode, &b.Country, &b.GSTIN,
		&b.CreatedAt, &b.UpdatedAt,
	)
}

// Upsert inserts or replaces the billing address for a user (one per user).
func (s *PGUserStore) Upsert(ctx context.Context, b *BillingAddress) error {
	err := s.pool.QueryRow(ctx, `INSERT INTO billing_addresses
		(user_id, billing_name, address_line1, address_line2, city, state, pincode, country, gstin)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
		ON CONFLICT (user_id) DO UPDATE SET
			billing_name = EXCLUDED.billing_name,
			address_line1 = EXCLUDED.address_line1,
			address_line2 = EXCLUDED.address_line2,
			city = EXCLUDED.city, state = EXCLUDED.state,
			pincode = EXCLUDED.pincode, country = EXCLUDED.country,
			gstin = EXCLUDED.gstin, updated_at = now()
		RETURNING `+billingColumns,
		b.UserID, b.BillingName, b.AddressLine1, nullIfEmpty(b.AddressLine2),
		b.City, b.State, b.Pincode, b.Country, nullIfEmpty(b.GSTIN),
	).Scan(
		&b.ID, &b.UserID, &b.BillingName, &b.AddressLine1, &b.AddressLine2,
		&b.City, &b.State, &b.Pincode, &b.Country, &b.GSTIN,
		&b.CreatedAt, &b.UpdatedAt,
	)
	return err
}

func (s *PGUserStore) GetByUserID(ctx context.Context, userID string) (*BillingAddress, error) {
	return scanBilling(s.pool.QueryRow(ctx,
		`SELECT `+billingColumns+` FROM billing_addresses WHERE user_id = $1`, userID))
}

func nullIfEmpty(s *string) any {
	if s == nil || strings.TrimSpace(*s) == "" {
		return nil
	}
	return *s
}
