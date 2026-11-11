package store

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// OutboxStore is the interface the mailer uses for the DB-backed email outbox.
type OutboxStore interface {
	Enqueue(ctx context.Context, m *OutboxMail) error
	MarkSent(ctx context.Context, id string) error
	MarkFailed(ctx context.Context, id, lastError string) error
	// ListDue returns rows needing a send attempt: pending, or failed with
	// fewer than 5 attempts (the reaper's retry budget).
	ListDue(ctx context.Context, limit int) ([]*OutboxMail, error)
}

// PGOutboxStore is the pgx implementation of OutboxStore.
type PGOutboxStore struct{ pool *pgxpool.Pool }

// NewPGOutboxStore returns an OutboxStore backed by pool.
func NewPGOutboxStore(pool *pgxpool.Pool) *PGOutboxStore { return &PGOutboxStore{pool: pool} }

const outboxColumns = `id, kind, to_email, to_name, subject, html_content,
	text_content, status, attempts, last_error, created_at, updated_at`

func scanOutbox(row pgx.Row) (*OutboxMail, error) {
	var m OutboxMail
	err := row.Scan(
		&m.ID, &m.Kind, &m.ToEmail, &m.ToName, &m.Subject, &m.HTMLContent,
		&m.TextContent, &m.Status, &m.Attempts, &m.LastError,
		&m.CreatedAt, &m.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, errNotFound
		}
		return nil, err
	}
	return &m, nil
}

func (s *PGOutboxStore) Enqueue(ctx context.Context, m *OutboxMail) error {
	if m.Kind == "" {
		m.Kind = OutboxKindTransactional
	}
	return s.pool.QueryRow(ctx, `INSERT INTO email_outbox
		(kind, to_email, to_name, subject, html_content, text_content)
		VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING `+outboxColumns,
		m.Kind, m.ToEmail, m.ToName, m.Subject, m.HTMLContent, m.TextContent,
	).Scan(
		&m.ID, &m.Kind, &m.ToEmail, &m.ToName, &m.Subject, &m.HTMLContent,
		&m.TextContent, &m.Status, &m.Attempts, &m.LastError,
		&m.CreatedAt, &m.UpdatedAt,
	)
}

func (s *PGOutboxStore) MarkSent(ctx context.Context, id string) error {
	_, err := s.pool.Exec(ctx,
		`UPDATE email_outbox
		 SET status = 'sent', attempts = attempts + 1, last_error = NULL, updated_at = now()
		 WHERE id = $1`, id)
	return err
}

func (s *PGOutboxStore) MarkFailed(ctx context.Context, id, lastError string) error {
	_, err := s.pool.Exec(ctx,
		`UPDATE email_outbox
		 SET status = 'failed', attempts = attempts + 1, last_error = $2, updated_at = now()
		 WHERE id = $1`, id, lastError)
	return err
}

func (s *PGOutboxStore) ListDue(ctx context.Context, limit int) ([]*OutboxMail, error) {
	if limit <= 0 {
		limit = 50
	}
	rows, err := s.pool.Query(ctx,
		`SELECT `+outboxColumns+` FROM email_outbox
		 WHERE status = 'pending' OR (status = 'failed' AND attempts < 5)
		 ORDER BY created_at ASC LIMIT $1`, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	mails := []*OutboxMail{}
	for rows.Next() {
		m, err := scanOutbox(rows)
		if err != nil {
			return nil, err
		}
		mails = append(mails, m)
	}
	return mails, rows.Err()
}
