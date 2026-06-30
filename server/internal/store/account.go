package store

import (
	"database/sql"
	"time"
)

// SetPassword updates a user's password hash and clears the must-change flag.
func (s *Store) SetPassword(userID, passwordHash string) error {
	_, err := s.DB.Exec(
		`UPDATE users SET password_hash = ?, must_change_password = 0, updated_at = ? WHERE id = ?`,
		passwordHash, time.Now().UTC().Format(time.RFC3339), userID)
	return err
}

// SetEmail updates a user's email.
func (s *Store) SetEmail(userID, email string) error {
	_, err := s.DB.Exec(
		`UPDATE users SET email = ?, updated_at = ? WHERE id = ?`,
		email, time.Now().UTC().Format(time.RFC3339), userID)
	return err
}

// SetProfile updates a user's display name and preset avatar (nil clears).
func (s *Store) SetProfile(userID string, name, avatar *string) error {
	_, err := s.DB.Exec(
		`UPDATE users SET name = ?, avatar = ?, updated_at = ? WHERE id = ?`,
		emptyToNil(name), emptyToNil(avatar), time.Now().UTC().Format(time.RFC3339), userID)
	return err
}

// SetPrefs updates any subset of UI preferences. Nil fields are left unchanged.
func (s *Store) SetPrefs(userID string, theme, motion, locale *string, notifications *bool) error {
	sets := []string{"updated_at = ?"}
	args := []any{time.Now().UTC().Format(time.RFC3339)}
	if theme != nil {
		sets = append(sets, "theme = ?")
		args = append(args, *theme)
	}
	if motion != nil {
		sets = append(sets, "motion = ?")
		args = append(args, *motion)
	}
	if locale != nil {
		sets = append(sets, "locale = ?")
		args = append(args, *locale)
	}
	if notifications != nil {
		sets = append(sets, "notifications_enabled = ?")
		args = append(args, boolToInt(*notifications))
	}
	if len(sets) == 1 {
		return nil // nothing to update
	}
	args = append(args, userID)
	_, err := s.DB.Exec(`UPDATE users SET `+join(sets)+` WHERE id = ?`, args...)
	return err
}

// ExportUser returns a JSON-serializable snapshot of a user's own data.
func (s *Store) ExportUser(userID string) (map[string]any, error) {
	u, err := s.UserByID(userID)
	if err != nil {
		return nil, err
	}
	roles, err := s.rolesRefForUser(userID)
	if err != nil {
		return nil, err
	}
	sessions, err := s.ListSessions(userID, "")
	if err != nil {
		return nil, err
	}
	return map[string]any{
		"id":                   u.ID,
		"email":                u.Email,
		"name":                 nsValue(u.Name),
		"avatar":               nsValue(u.Avatar),
		"theme":                u.Theme,
		"motion":               u.Motion,
		"locale":               u.Locale,
		"notificationsEnabled": u.NotificationsEnabled,
		"roles":                roles,
		"sessionCount":         len(sessions),
	}, nil
}

func emptyToNil(s *string) any {
	if s == nil || *s == "" {
		return nil
	}
	return *s
}

func boolToInt(b bool) int {
	if b {
		return 1
	}
	return 0
}

func join(parts []string) string {
	out := ""
	for i, p := range parts {
		if i > 0 {
			out += ", "
		}
		out += p
	}
	return out
}

func nsValue(ns sql.NullString) any {
	if !ns.Valid {
		return nil
	}
	return ns.String
}
