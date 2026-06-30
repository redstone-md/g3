package store

import (
	"database/sql"
	"errors"
	"fmt"
	"strings"
	"time"

	"g3/internal/auth"
)

// RoleRef is a minimal role reference embedded in a user DTO.
type RoleRef struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

// UserListItem is one row of the users table for the panel list.
type UserListItem struct {
	ID                 string         `json:"id"`
	Email              string         `json:"email"`
	Name               sql.NullString `json:"-"`
	MustChangePassword bool           `json:"mustChangePassword"`
	Avatar             sql.NullString `json:"-"`
	CreatedAt          string         `json:"createdAt"`
	Roles              []RoleRef      `json:"roles"`
}

var userSortColumns = map[string]string{
	"email":     "email",
	"name":      "name",
	"createdAt": "created_at",
}

// ListUsers returns a page of users (with roles) and the total count.
func (s *Store) ListUsers(q, sort, order string, limit, offset int) ([]UserListItem, int, error) {
	col, ok := userSortColumns[sort]
	if !ok {
		col = "created_at"
	}
	dir := "DESC"
	if strings.ToLower(order) == "asc" {
		dir = "ASC"
	}

	where := ""
	args := []any{}
	if q != "" {
		where = "WHERE email LIKE ? OR name LIKE ?"
		like := "%" + q + "%"
		args = append(args, like, like)
	}

	var total int
	if err := s.DB.QueryRow(`SELECT COUNT(*) FROM users `+where, args...).Scan(&total); err != nil {
		return nil, 0, err
	}

	query := fmt.Sprintf(
		`SELECT id, email, name, must_change_password, avatar, created_at
		 FROM users %s ORDER BY %s %s LIMIT ? OFFSET ?`, where, col, dir)
	rows, err := s.DB.Query(query, append(args, limit, offset)...)
	if err != nil {
		return nil, 0, err
	}
	items := []UserListItem{}
	for rows.Next() {
		var u UserListItem
		if err := rows.Scan(&u.ID, &u.Email, &u.Name, &u.MustChangePassword, &u.Avatar, &u.CreatedAt); err != nil {
			rows.Close()
			return nil, 0, err
		}
		items = append(items, u)
	}
	if err := rows.Err(); err != nil {
		rows.Close()
		return nil, 0, err
	}
	rows.Close()

	// Attach roles per user (page is small; avoids a wide join).
	for i := range items {
		refs, err := s.rolesRefForUser(items[i].ID)
		if err != nil {
			return nil, 0, err
		}
		items[i].Roles = refs
	}
	return items, total, nil
}

// RolesForUserRefs is the exported accessor for a user's role references.
func (s *Store) RolesForUserRefs(userID string) ([]RoleRef, error) {
	return s.rolesRefForUser(userID)
}

func (s *Store) rolesRefForUser(userID string) ([]RoleRef, error) {
	rows, err := s.DB.Query(
		`SELECT r.id, r.name FROM roles r
		 JOIN user_roles ur ON ur.role_id = r.id
		 WHERE ur.user_id = ? ORDER BY r.name`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	refs := []RoleRef{}
	for rows.Next() {
		var ref RoleRef
		if err := rows.Scan(&ref.ID, &ref.Name); err != nil {
			return nil, err
		}
		refs = append(refs, ref)
	}
	return refs, rows.Err()
}

// EmailExists reports whether an email is taken by a different user.
func (s *Store) EmailExists(email, excludeID string) (bool, error) {
	var id string
	err := s.DB.QueryRow(`SELECT id FROM users WHERE email = ?`, email).Scan(&id)
	if errors.Is(err, sql.ErrNoRows) {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	return id != excludeID, nil
}

// CreateUser inserts a user and assigns roles. Returns the new id.
func (s *Store) CreateUser(email, name, passwordHash string, roleIDs []string) (string, error) {
	now := time.Now().UTC().Format(time.RFC3339)
	id := auth.NewID()
	var namePtr any
	if name != "" {
		namePtr = name
	}
	if _, err := s.DB.Exec(
		`INSERT INTO users (id, email, name, password_hash, must_change_password, created_at, updated_at)
		 VALUES (?, ?, ?, ?, 0, ?, ?)`,
		id, email, namePtr, passwordHash, now, now,
	); err != nil {
		return "", err
	}
	if err := s.setUserRoles(id, roleIDs); err != nil {
		return "", err
	}
	return id, nil
}

// UpdateUser applies optional name/roles/password changes.
func (s *Store) UpdateUser(id string, name *string, roleIDs *[]string, passwordHash *string) error {
	sets := []string{"updated_at = ?"}
	args := []any{time.Now().UTC().Format(time.RFC3339)}
	if name != nil {
		sets = append(sets, "name = ?")
		if *name == "" {
			args = append(args, nil)
		} else {
			args = append(args, *name)
		}
	}
	if passwordHash != nil {
		sets = append(sets, "password_hash = ?", "must_change_password = 0")
		args = append(args, *passwordHash)
	}
	args = append(args, id)
	if _, err := s.DB.Exec(`UPDATE users SET `+strings.Join(sets, ", ")+` WHERE id = ?`, args...); err != nil {
		return err
	}
	if roleIDs != nil {
		return s.setUserRoles(id, *roleIDs)
	}
	return nil
}

// DeleteUser removes a user and its role/session rows.
func (s *Store) DeleteUser(id string) error {
	if _, err := s.DB.Exec(`DELETE FROM user_roles WHERE user_id = ?`, id); err != nil {
		return err
	}
	if _, err := s.DB.Exec(`DELETE FROM sessions WHERE user_id = ?`, id); err != nil {
		return err
	}
	_, err := s.DB.Exec(`DELETE FROM users WHERE id = ?`, id)
	return err
}

// setUserRoles replaces a user's role assignments with the given (existing) ids.
func (s *Store) setUserRoles(userID string, roleIDs []string) error {
	if _, err := s.DB.Exec(`DELETE FROM user_roles WHERE user_id = ?`, userID); err != nil {
		return err
	}
	for _, rid := range roleIDs {
		var exists string
		if err := s.DB.QueryRow(`SELECT id FROM roles WHERE id = ?`, rid).Scan(&exists); err != nil {
			continue // skip unknown role ids
		}
		if _, err := s.DB.Exec(
			`INSERT OR IGNORE INTO user_roles (user_id, role_id) VALUES (?, ?)`, userID, rid,
		); err != nil {
			return err
		}
	}
	return nil
}
