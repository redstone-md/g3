package store

import (
	"database/sql"
	"fmt"
	"time"

	"g3/internal/auth"
)

// AuditEntry is one audit-log row for the panel list.
type AuditEntry struct {
	ID         string         `json:"id"`
	Action     string         `json:"action"`
	ActorEmail sql.NullString `json:"-"`
	TargetType sql.NullString `json:"-"`
	TargetID   sql.NullString `json:"-"`
	IP         sql.NullString `json:"-"`
	CreatedAt  string         `json:"createdAt"`
}

// ListAudit returns a page of audit entries (newest first) and the total.
func (s *Store) ListAudit(q string, limit, offset int) ([]AuditEntry, int, error) {
	where := ""
	args := []any{}
	if q != "" {
		where = "WHERE action LIKE ? OR actor_email LIKE ?"
		like := "%" + q + "%"
		args = append(args, like, like)
	}

	var total int
	if err := s.DB.QueryRow(`SELECT COUNT(*) FROM audit_log `+where, args...).Scan(&total); err != nil {
		return nil, 0, err
	}

	query := fmt.Sprintf(
		`SELECT id, action, actor_email, target_type, target_id, ip, created_at
		 FROM audit_log %s ORDER BY created_at DESC LIMIT ? OFFSET ?`, where)
	rows, err := s.DB.Query(query, append(args, limit, offset)...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	items := []AuditEntry{}
	for rows.Next() {
		var e AuditEntry
		if err := rows.Scan(&e.ID, &e.Action, &e.ActorEmail, &e.TargetType, &e.TargetID, &e.IP, &e.CreatedAt); err != nil {
			return nil, 0, err
		}
		items = append(items, e)
	}
	return items, total, rows.Err()
}

// LogAuditFull appends a fully-specified audit entry (best-effort).
func (s *Store) LogAuditFull(action, actorID, actorEmail, targetType, targetID, ip string) {
	_, _ = s.DB.Exec(
		`INSERT INTO audit_log (id, action, actor_id, actor_email, target_type, target_id, ip, created_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
		auth.NewID(), action, nz(actorID), nz(actorEmail), nz(targetType), nz(targetID), nz(ip),
		time.Now().UTC().Format(time.RFC3339),
	)
}

func nz(s string) any {
	if s == "" {
		return nil
	}
	return s
}
