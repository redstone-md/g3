package store

import (
	"database/sql"
	"encoding/json"
	"errors"
	"time"

	"g3/internal/auth"
)

// ErrNotFound is returned when a lookup matches no row.
var ErrNotFound = errors.New("not found")

// User mirrors the users table.
type User struct {
	ID                   string
	Email                string
	Name                 sql.NullString
	PasswordHash         string
	MustChangePassword   bool
	Theme                string
	Motion               string
	Locale               string
	Avatar               sql.NullString
	NotificationsEnabled bool
}

// Role mirrors the roles table (JSON columns decoded).
type Role struct {
	ID          string
	Name        string
	Permissions []string
	ParentIDs   []string
	IsSystem    bool
}

const userCols = `id, email, name, password_hash, must_change_password,
	theme, motion, locale, avatar, notifications_enabled`

func scanUser(row interface{ Scan(...any) error }) (*User, error) {
	var u User
	if err := row.Scan(&u.ID, &u.Email, &u.Name, &u.PasswordHash, &u.MustChangePassword,
		&u.Theme, &u.Motion, &u.Locale, &u.Avatar, &u.NotificationsEnabled); err != nil {
		return nil, err
	}
	return &u, nil
}

// UserByEmail looks up a user by email (case-sensitive; callers normalize).
func (s *Store) UserByEmail(email string) (*User, error) {
	row := s.DB.QueryRow(`SELECT `+userCols+` FROM users WHERE email = ?`, email)
	u, err := scanUser(row)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrNotFound
	}
	return u, err
}

// UserByID looks up a user by id.
func (s *Store) UserByID(id string) (*User, error) {
	row := s.DB.QueryRow(`SELECT `+userCols+` FROM users WHERE id = ?`, id)
	u, err := scanUser(row)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrNotFound
	}
	return u, err
}

// loadRoles returns every role keyed by id (for inheritance resolution).
func (s *Store) loadRoles() (map[string]Role, error) {
	rows, err := s.DB.Query(`SELECT id, name, permissions, parent_ids, is_system FROM roles`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := map[string]Role{}
	for rows.Next() {
		var r Role
		var perms, parents string
		if err := rows.Scan(&r.ID, &r.Name, &perms, &parents, &r.IsSystem); err != nil {
			return nil, err
		}
		_ = json.Unmarshal([]byte(perms), &r.Permissions)
		_ = json.Unmarshal([]byte(parents), &r.ParentIDs)
		out[r.ID] = r
	}
	return out, rows.Err()
}

// roleIDsForUser returns the directly-assigned role ids for a user.
func (s *Store) roleIDsForUser(userID string) ([]string, error) {
	rows, err := s.DB.Query(`SELECT role_id FROM user_roles WHERE user_id = ?`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var ids []string
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		ids = append(ids, id)
	}
	return ids, rows.Err()
}

// RolesForUser returns the user's directly-assigned roles.
func (s *Store) RolesForUser(userID string) ([]Role, error) {
	all, err := s.loadRoles()
	if err != nil {
		return nil, err
	}
	ids, err := s.roleIDsForUser(userID)
	if err != nil {
		return nil, err
	}
	var roles []Role
	for _, id := range ids {
		if r, ok := all[id]; ok {
			roles = append(roles, r)
		}
	}
	return roles, nil
}

// effectivePermsFrom resolves the transitive union of permissions across the
// given role ids and all their ancestors.
func effectivePermsFrom(all map[string]Role, roleIDs []string) []string {
	permSet := map[string]struct{}{}
	visited := map[string]struct{}{}
	var visit func(id string)
	visit = func(id string) {
		if _, seen := visited[id]; seen {
			return
		}
		visited[id] = struct{}{}
		r, ok := all[id]
		if !ok {
			return
		}
		for _, p := range r.Permissions {
			permSet[p] = struct{}{}
		}
		for _, parent := range r.ParentIDs {
			visit(parent)
		}
	}
	for _, id := range roleIDs {
		visit(id)
	}
	out := make([]string, 0, len(permSet))
	for p := range permSet {
		out = append(out, p)
	}
	return out
}

// EffectivePermissions returns the union of permissions for a user across all
// inherited roles.
func (s *Store) EffectivePermissions(userID string) ([]string, error) {
	all, err := s.loadRoles()
	if err != nil {
		return nil, err
	}
	ids, err := s.roleIDsForUser(userID)
	if err != nil {
		return nil, err
	}
	return effectivePermsFrom(all, ids), nil
}

// IsLastAdmin reports whether userID is the only account holding the admin grant.
func (s *Store) IsLastAdmin(userID string) (bool, error) {
	all, err := s.loadRoles()
	if err != nil {
		return false, err
	}
	// Collect user ids first; with MaxOpenConns(1) we must not run nested
	// queries while a result set is still open (it would deadlock).
	rows, err := s.DB.Query(`SELECT DISTINCT user_id FROM user_roles`)
	if err != nil {
		return false, err
	}
	var uids []string
	for rows.Next() {
		var uid string
		if err := rows.Scan(&uid); err != nil {
			rows.Close()
			return false, err
		}
		uids = append(uids, uid)
	}
	if err := rows.Err(); err != nil {
		rows.Close()
		return false, err
	}
	rows.Close()

	admins := 0
	userIsAdmin := false
	for _, uid := range uids {
		ids, err := s.roleIDsForUser(uid)
		if err != nil {
			return false, err
		}
		if contains(effectivePermsFrom(all, ids), auth.AdminGrant) {
			admins++
			if uid == userID {
				userIsAdmin = true
			}
		}
	}
	return userIsAdmin && admins <= 1, nil
}

func contains(xs []string, target string) bool {
	for _, x := range xs {
		if x == target {
			return true
		}
	}
	return false
}

// Session mirrors the sessions table.
type Session struct {
	ID     string
	UserID string
}

// CreateSession stores a new session row.
func (s *Store) CreateSession(userID, tokenHash, userAgent, ip string, expires time.Time) error {
	_, err := s.DB.Exec(
		`INSERT INTO sessions (id, token_hash, user_id, user_agent, ip, expires_at, created_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?)`,
		auth.NewID(), tokenHash, userID, userAgent, ip,
		expires.UTC().Format(time.RFC3339), time.Now().UTC().Format(time.RFC3339),
	)
	return err
}

// UserBySessionToken resolves a session token hash to its (non-expired) user.
func (s *Store) UserBySessionToken(tokenHash string) (*User, error) {
	var userID, expiresAt string
	err := s.DB.QueryRow(
		`SELECT user_id, expires_at FROM sessions WHERE token_hash = ?`, tokenHash,
	).Scan(&userID, &expiresAt)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	if exp, perr := time.Parse(time.RFC3339, expiresAt); perr == nil && time.Now().After(exp) {
		_ = s.DeleteSession(tokenHash)
		return nil, ErrNotFound
	}
	return s.UserByID(userID)
}

// DeleteSession removes a session by token hash.
func (s *Store) DeleteSession(tokenHash string) error {
	_, err := s.DB.Exec(`DELETE FROM sessions WHERE token_hash = ?`, tokenHash)
	return err
}

// LogAudit appends an audit entry (best-effort; callers ignore the error).
func (s *Store) LogAudit(action, actorID, actorEmail string) {
	_, _ = s.DB.Exec(
		`INSERT INTO audit_log (id, action, actor_id, actor_email, created_at)
		 VALUES (?, ?, ?, ?, ?)`,
		auth.NewID(), action, actorID, actorEmail, time.Now().UTC().Format(time.RFC3339),
	)
}
