package store

import "database/sql"

// SessionInfo is one active session for the account settings list.
type SessionInfo struct {
	ID        string         `json:"id"`
	UserAgent sql.NullString `json:"-"`
	IP        sql.NullString `json:"-"`
	CreatedAt string         `json:"createdAt"`
	Current   bool           `json:"current"`
}

// ListSessions returns a user's active sessions, marking the current one.
func (s *Store) ListSessions(userID, currentTokenHash string) ([]SessionInfo, error) {
	rows, err := s.DB.Query(
		`SELECT id, token_hash, user_agent, ip, created_at
		 FROM sessions WHERE user_id = ? ORDER BY created_at DESC`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := []SessionInfo{}
	for rows.Next() {
		var info SessionInfo
		var tokenHash string
		if err := rows.Scan(&info.ID, &tokenHash, &info.UserAgent, &info.IP, &info.CreatedAt); err != nil {
			return nil, err
		}
		info.Current = tokenHash == currentTokenHash
		items = append(items, info)
	}
	return items, rows.Err()
}

// DeleteSessionForUser revokes one session by id, scoped to the owner.
func (s *Store) DeleteSessionForUser(userID, sessionID string) error {
	_, err := s.DB.Exec(`DELETE FROM sessions WHERE id = ? AND user_id = ?`, sessionID, userID)
	return err
}

// DeleteOtherSessions revokes every session for the user except the current one.
func (s *Store) DeleteOtherSessions(userID, currentTokenHash string) error {
	_, err := s.DB.Exec(
		`DELETE FROM sessions WHERE user_id = ? AND token_hash <> ?`, userID, currentTokenHash)
	return err
}
