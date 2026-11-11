package store

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// NoteStore is the interface handlers use for order notes.
type NoteStore interface {
	Create(ctx context.Context, n *OrderNote) error
	// ListByOrder returns notes newest-first.
	ListByOrder(ctx context.Context, orderID string, limit, offset int) ([]*OrderNote, error)
}

// PGNoteStore is the pgx implementation of NoteStore.
type PGNoteStore struct{ pool *pgxpool.Pool }

// NewPGNoteStore returns a NoteStore backed by pool.
func NewPGNoteStore(pool *pgxpool.Pool) *PGNoteStore { return &PGNoteStore{pool: pool} }

const noteColumns = `id, order_id, author_user_id, note, created_at`

func scanNote(row pgx.Row) (*OrderNote, error) {
	var n OrderNote
	err := row.Scan(&n.ID, &n.OrderID, &n.AuthorUserID, &n.Note, &n.CreatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, errNotFound
		}
		return nil, err
	}
	return &n, nil
}

func (s *PGNoteStore) Create(ctx context.Context, n *OrderNote) error {
	return s.pool.QueryRow(ctx, `INSERT INTO order_notes
		(order_id, author_user_id, note)
		VALUES ($1, $2, $3)
		RETURNING `+noteColumns,
		n.OrderID, n.AuthorUserID, n.Note,
	).Scan(&n.ID, &n.OrderID, &n.AuthorUserID, &n.Note, &n.CreatedAt)
}

func (s *PGNoteStore) ListByOrder(ctx context.Context, orderID string, limit, offset int) ([]*OrderNote, error) {
	if limit <= 0 {
		limit = 20
	}
	if limit > 100 {
		limit = 100
	}
	if offset < 0 {
		offset = 0
	}
	rows, err := s.pool.Query(ctx,
		`SELECT `+noteColumns+` FROM order_notes
		 WHERE order_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
		orderID, limit, offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	notes := []*OrderNote{}
	for rows.Next() {
		n, err := scanNote(rows)
		if err != nil {
			return nil, err
		}
		notes = append(notes, n)
	}
	return notes, rows.Err()
}
