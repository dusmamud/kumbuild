package store

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// TokenStore is the interface handlers use for OTP / reset / invite tokens.
type TokenStore interface {
	Create(ctx context.Context, t *AuthToken) error
	// GetValidByHash returns the token only if kind matches, it has not
	// expired and it has not been used yet.
	GetValidByHash(ctx context.Context, kind, tokenHash string) (*AuthToken, error)
	MarkUsed(ctx context.Context, id string) error
	IncrementAttempts(ctx context.Context, id string) error
	InvalidateKindForUser(ctx context.Context, userID, kind string) error
}

// PGTokenStore is the pgx implementation of TokenStore.
type PGTokenStore struct{ pool *pgxpool.Pool }

// NewPGTokenStore returns a TokenStore backed by pool.
func NewPGTokenStore(pool *pgxpool.Pool) *PGTokenStore { return &PGTokenStore{pool: pool} }

const tokenColumns = `id, user_id, kind, token_hash, expires_at, used_at, attempts, created_at`

func scanToken(row pgx.Row) (*AuthToken, error) {
	var t AuthToken
	err := row.Scan(
		&t.ID, &t.UserID, &t.Kind, &t.TokenHash, &t.ExpiresAt,
		&t.UsedAt, &t.Attempts, &t.CreatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, errNotFound
		}
		return nil, err
	}
	return &t, nil
}

func (s *PGTokenStore) Create(ctx context.Context, t *AuthToken) error {
	return s.pool.QueryRow(ctx, `INSERT INTO auth_tokens
		(user_id, kind, token_hash, expires_at)
		VALUES ($1, $2, $3, $4)
		RETURNING `+tokenColumns,
		t.UserID, t.Kind, t.TokenHash, t.ExpiresAt,
	).Scan(
		&t.ID, &t.UserID, &t.Kind, &t.TokenHash, &t.ExpiresAt,
		&t.UsedAt, &t.Attempts, &t.CreatedAt,
	)
}

func (s *PGTokenStore) GetValidByHash(ctx context.Context, kind, tokenHash string) (*AuthToken, error) {
	return scanToken(s.pool.QueryRow(ctx,
		`SELECT `+tokenColumns+` FROM auth_tokens
		 WHERE kind = $1 AND token_hash = $2
		   AND used_at IS NULL AND expires_at > now()
		 ORDER BY created_at DESC LIMIT 1`, kind, tokenHash))
}

func (s *PGTokenStore) MarkUsed(ctx context.Context, id string) error {
	tag, err := s.pool.Exec(ctx,
		`UPDATE auth_tokens SET used_at = now() WHERE id = $1 AND used_at IS NULL`, id)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return errNotFound
	}
	return nil
}

func (s *PGTokenStore) IncrementAttempts(ctx context.Context, id string) error {
	_, err := s.pool.Exec(ctx,
		`UPDATE auth_tokens SET attempts = attempts + 1 WHERE id = $1`, id)
	return err
}

// InvalidateKindForUser marks every unused token of this kind for the user
// as used — e.g. issuing a new invite kills the old invite token.
func (s *PGTokenStore) InvalidateKindForUser(ctx context.Context, userID, kind string) error {
	_, err := s.pool.Exec(ctx,
		`UPDATE auth_tokens SET used_at = now()
		 WHERE user_id = $1 AND kind = $2 AND used_at IS NULL`, userID, kind)
	return err
}

// Token TTLs (AUTH_PLAN.md §5): OTP 10 min, reset 30 min, invite 24h.
const (
	OTPTTL    = 10 * time.Minute
	ResetTTL  = 30 * time.Minute
	InviteTTL = 24 * time.Hour
)
