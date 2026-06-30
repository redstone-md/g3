package store

import (
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"g3/internal/auth"
)

// RoleDetail is a full role row for the panel list/editor.
type RoleDetail struct {
	ID          string         `json:"id"`
	Name        string         `json:"name"`
	Description sql.NullString `json:"-"`
	Permissions []string       `json:"permissions"`
	ParentIDs   []string       `json:"parentIds"`
	IsSystem    bool           `json:"isSystem"`
	UserCount   int            `json:"userCount"`
	CreatedAt   string         `json:"createdAt"`
}

var roleSortColumns = map[string]string{
	"name":      "name",
	"createdAt": "created_at",
}

// ListRoles returns a page of roles (with user counts) and the total.
func (s *Store) ListRoles(q, sort, order string, limit, offset int) ([]RoleDetail, int, error) {
	col, ok := roleSortColumns[sort]
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
		where = "WHERE name LIKE ? OR description LIKE ?"
		like := "%" + q + "%"
		args = append(args, like, like)
	}

	var total int
	if err := s.DB.QueryRow(`SELECT COUNT(*) FROM roles `+where, args...).Scan(&total); err != nil {
		return nil, 0, err
	}

	query := fmt.Sprintf(
		`SELECT id, name, description, permissions, parent_ids, is_system, created_at
		 FROM roles %s ORDER BY %s %s LIMIT ? OFFSET ?`, where, col, dir)
	rows, err := s.DB.Query(query, append(args, limit, offset)...)
	if err != nil {
		return nil, 0, err
	}
	items := []RoleDetail{}
	for rows.Next() {
		var r RoleDetail
		var perms, parents string
		if err := rows.Scan(&r.ID, &r.Name, &r.Description, &perms, &parents, &r.IsSystem, &r.CreatedAt); err != nil {
			rows.Close()
			return nil, 0, err
		}
		_ = json.Unmarshal([]byte(perms), &r.Permissions)
		_ = json.Unmarshal([]byte(parents), &r.ParentIDs)
		if r.Permissions == nil {
			r.Permissions = []string{}
		}
		if r.ParentIDs == nil {
			r.ParentIDs = []string{}
		}
		items = append(items, r)
	}
	if err := rows.Err(); err != nil {
		rows.Close()
		return nil, 0, err
	}
	rows.Close()

	for i := range items {
		var count int
		if err := s.DB.QueryRow(`SELECT COUNT(*) FROM user_roles WHERE role_id = ?`, items[i].ID).Scan(&count); err != nil {
			return nil, 0, err
		}
		items[i].UserCount = count
	}
	return items, total, nil
}

// RoleByID returns a single role.
func (s *Store) RoleByID(id string) (*RoleDetail, error) {
	var r RoleDetail
	var perms, parents string
	err := s.DB.QueryRow(
		`SELECT id, name, description, permissions, parent_ids, is_system, created_at
		 FROM roles WHERE id = ?`, id,
	).Scan(&r.ID, &r.Name, &r.Description, &perms, &parents, &r.IsSystem, &r.CreatedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	_ = json.Unmarshal([]byte(perms), &r.Permissions)
	_ = json.Unmarshal([]byte(parents), &r.ParentIDs)
	return &r, nil
}

// RoleNameExists reports whether a role name is taken by a different role.
func (s *Store) RoleNameExists(name, excludeID string) (bool, error) {
	var id string
	err := s.DB.QueryRow(`SELECT id FROM roles WHERE name = ?`, name).Scan(&id)
	if errors.Is(err, sql.ErrNoRows) {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	return id != excludeID, nil
}

// CreateRole inserts a custom (non-system) role and returns its id.
func (s *Store) CreateRole(name, description string, permissions, parentIDs []string) (string, error) {
	now := time.Now().UTC().Format(time.RFC3339)
	id := auth.NewID()
	perms, _ := json.Marshal(sanitizePermissions(permissions))
	parents, _ := json.Marshal(parentIDs)
	var descPtr any
	if description != "" {
		descPtr = description
	}
	_, err := s.DB.Exec(
		`INSERT INTO roles (id, name, description, permissions, parent_ids, is_system, created_at, updated_at)
		 VALUES (?, ?, ?, ?, ?, 0, ?, ?)`,
		id, name, descPtr, string(perms), string(parents), now, now,
	)
	return id, err
}

// UpdateRole updates a role's fields (name/permissions/parents always settable;
// system roles keep is_system).
func (s *Store) UpdateRole(id, name, description string, permissions, parentIDs []string) error {
	perms, _ := json.Marshal(sanitizePermissions(permissions))
	parents, _ := json.Marshal(parentIDs)
	var descPtr any
	if description != "" {
		descPtr = description
	}
	_, err := s.DB.Exec(
		`UPDATE roles SET name = ?, description = ?, permissions = ?, parent_ids = ?, updated_at = ?
		 WHERE id = ?`,
		name, descPtr, string(perms), string(parents), time.Now().UTC().Format(time.RFC3339), id,
	)
	return err
}

// DeleteRole removes a non-system role and its assignments.
func (s *Store) DeleteRole(id string) error {
	if _, err := s.DB.Exec(`DELETE FROM user_roles WHERE role_id = ?`, id); err != nil {
		return err
	}
	_, err := s.DB.Exec(`DELETE FROM roles WHERE id = ?`, id)
	return err
}

// sanitizePermissions drops any unknown keys so a bad payload cannot grant a
// phantom permission (mirrors src/lib/permissions.ts).
func sanitizePermissions(keys []string) []string {
	valid := map[string]struct{}{}
	for _, p := range auth.AllPermissions {
		valid[p] = struct{}{}
	}
	seen := map[string]struct{}{}
	out := []string{}
	for _, k := range keys {
		if _, ok := valid[k]; !ok {
			continue
		}
		if _, dup := seen[k]; dup {
			continue
		}
		seen[k] = struct{}{}
		out = append(out, k)
	}
	return out
}
