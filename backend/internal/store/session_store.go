package store

import (
	"context"
	"errors"
	"net/netip"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// SessionStore is the interface handlers use for login sessions.
type SessionStore interface {
	Create(ctx context.Context, s *Session) error
	GetByTokenHash(ctx context.Context, tokenHash string) (*Session, error)
	TouchLastSeen(ctx context.Context, id string) error
	Delete(ctx context.Context, id string) error
	DeleteAllForUser(ctx context.Context, userID string) error
}

// PGSessionStore is the pgx implementation of SessionStore.
type PGSessionStore struct{ pool *pgxpool.Pool }

// NewPGSessionStore returns a SessionStore backed by pool.
func NewPGSessionStore(pool *pgxpool.Pool) *PGSessionStore { return &PGSessionStore{pool: pool} }

const sessionColumns = `id, user_id, token_hash, created_at, expires_at, last_seen_at, ip, user_agent`

func scanSession(row pgx.Row) (*Session, error) {
	var s Session
	err := row.Scan(
		&s.ID, &s.UserID, &s.TokenHash, &s.CreatedAt, &s.ExpiresAt,
		&s.LastSeenAt, &s.IP, &s.UserAgent,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, errNotFound
		}
		return nil, err
	}
	return &s, nil
}

// ipArg converts a netip.Addr to a driver value: nil when invalid (NULL).
func ipArg(ip netip.Addr) any {
	if !ip.IsValid() {
		return nil
	}
	return ip
}

func (s *PGSessionStore) Create(ctx context.Context, sess *Session) error {
	return s.pool.QueryRow(ctx, `INSERT INTO sessions
		(user_id, token_hash, expires_at, last_seen_at, ip, user_agent)
		VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING `+sessionColumns,
		sess.UserID, sess.TokenHash, sess.ExpiresAt, sess.LastSeenAt,
		ipArg(sess.IP), sess.UserAgent,
	).Scan(
		&sess.ID, &sess.UserID, &sess.TokenHash, &sess.CreatedAt, &sess.ExpiresAt,
		&sess.LastSeenAt, &sess.IP, &sess.UserAgent,
	)
}

func (s *PGSessionStore) GetByTokenHash(ctx context.Context, tokenHash string) (*Session, error) {
	return scanSession(s.pool.QueryRow(ctx,
		`SELECT `+sessionColumns+` FROM sessions WHERE token_hash = $1`, tokenHash))
}

// TouchLastSeen refreshes the idle clock (24h idle timeout, §6).
func (s *PGSessionStore) TouchLastSeen(ctx context.Context, id string) error {
	_, err := s.pool.Exec(ctx,
		`UPDATE sessions SET last_seen_at = now() WHERE id = $1`, id)
	return err
}

func (s *PGSessionStore) Delete(ctx context.Context, id string) error {
	_, err := s.pool.Exec(ctx, `DELETE FROM sessions WHERE id = $1`, id)
	return err
}

// DeleteAllForUser invalidates every session of a user — used on disable,
// password reset and admin force-reset (immediate logout everywhere).
func (s *PGSessionStore) DeleteAllForUser(ctx context.Context, userID string) error {
	_, err := s.pool.Exec(ctx, `DELETE FROM sessions WHERE user_id = $1`, userID)
	return err
}

// SessionTTL constants: 7 days absolute, 24h idle (AUTH_PLAN.md §5).
const (
	SessionAbsoluteTTL = 7 * 24 * time.Hour
	SessionIdleTTL     = 24 * time.Hour
)
