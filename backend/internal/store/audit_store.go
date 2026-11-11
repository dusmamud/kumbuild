package store

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// AuditStore is the interface handlers use for audit logs.
type AuditStore interface {
	// Insert writes one log row. When tx != nil the row is written inside
	// the caller's transaction (audit-first, then the change); when tx is
	// nil it is inserted standalone.
	Insert(ctx context.Context, tx pgx.Tx, l *AuditLog) error
	List(ctx context.Context, actorID, targetID, action string, limit, offset int) ([]*AuditLog, int, error)
}

// PGAuditStore is the pgx implementation of AuditStore.
type PGAuditStore struct{ pool *pgxpool.Pool }

// NewPGAuditStore returns an AuditStore backed by pool.
func NewPGAuditStore(pool *pgxpool.Pool) *PGAuditStore { return &PGAuditStore{pool: pool} }

const auditColumns = `id, actor_user_id, action, target_user_id, details, ip, created_at`

func scanAudit(row pgx.Row) (*AuditLog, error) {
	var a AuditLog
	var details []byte
	err := row.Scan(
		&a.ID, &a.ActorUserID, &a.Action, &a.TargetUserID, &details,
		&a.IP, &a.CreatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, errNotFound
		}
		return nil, err
	}
	if len(details) > 0 {
		if err := json.Unmarshal(details, &a.Details); err != nil {
			return nil, err
		}
	}
	if a.Details == nil {
		a.Details = map[string]any{}
	}
	return &a, nil
}

func (s *PGAuditStore) Insert(ctx context.Context, tx pgx.Tx, l *AuditLog) error {
	details, err := json.Marshal(l.Details)
	if err != nil {
		return err
	}
	if l.Details == nil {
		details = []byte("{}")
	}
	// pgx.Tx and *pgxpool.Pool share the QueryRow signature; pick the executor.
	// details go in as a string so $4::jsonb casts text -> jsonb.
	var row pgx.Row
	if tx != nil {
		row = tx.QueryRow(ctx, `INSERT INTO audit_logs
			(actor_user_id, action, target_user_id, details, ip)
			VALUES ($1, $2, $3, $4::jsonb, $5)
			RETURNING `+auditColumns,
			l.ActorUserID, l.Action, l.TargetUserID, string(details), ipArg(l.IP))
	} else {
		row = s.pool.QueryRow(ctx, `INSERT INTO audit_logs
			(actor_user_id, action, target_user_id, details, ip)
			VALUES ($1, $2, $3, $4::jsonb, $5)
			RETURNING `+auditColumns,
			l.ActorUserID, l.Action, l.TargetUserID, string(details), ipArg(l.IP))
	}
	var raw []byte
	err = row.Scan(
		&l.ID, &l.ActorUserID, &l.Action, &l.TargetUserID, &raw,
		&l.IP, &l.CreatedAt,
	)
	if err != nil {
		return err
	}
	return json.Unmarshal(raw, &l.Details)
}

// List returns audit rows newest-first. Empty actorID/targetID/action = no filter.
func (s *PGAuditStore) List(ctx context.Context, actorID, targetID, action string, limit, offset int) ([]*AuditLog, int, error) {
	if limit <= 0 {
		limit = 20
	}
	if limit > 100 {
		limit = 100
	}
	if offset < 0 {
		offset = 0
	}
	var conds []string
	var args []any
	if actorID != "" {
		args = append(args, actorID)
		conds = append(conds, fmt.Sprintf("actor_user_id = $%d", len(args)))
	}
	if targetID != "" {
		args = append(args, targetID)
		conds = append(conds, fmt.Sprintf("target_user_id = $%d", len(args)))
	}
	if action != "" {
		args = append(args, action)
		conds = append(conds, fmt.Sprintf("action = $%d", len(args)))
	}
	where := ""
	if len(conds) > 0 {
		where = "WHERE " + strings.Join(conds, " AND ")
	}

	var total int
	if err := s.pool.QueryRow(ctx,
		`SELECT COUNT(*) FROM audit_logs `+where, args...).Scan(&total); err != nil {
		return nil, 0, err
	}
	rows, err := s.pool.Query(ctx,
		`SELECT `+auditColumns+` FROM audit_logs `+where+
			` ORDER BY created_at DESC LIMIT $`+fmt.Sprint(len(args)+1)+
			` OFFSET $`+fmt.Sprint(len(args)+2),
		append(append([]any{}, args...), limit, offset)...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	logs := []*AuditLog{}
	for rows.Next() {
		a, err := scanAudit(rows)
		if err != nil {
			return nil, 0, err
		}
		logs = append(logs, a)
	}
	return logs, total, rows.Err()
}
