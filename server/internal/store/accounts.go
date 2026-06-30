package store

import (
	"database/sql"
	"errors"
	"time"

	"g3/internal/auth"
)

// DriveAccount is a linked Google account used as a storage backend.
type DriveAccount struct {
	ID           string         `json:"id"`
	Email        string         `json:"email"`
	Status       string         `json:"status"`
	Weight       int            `json:"weight"`
	FolderID     sql.NullString `json:"-"`
	StorageLimit int64          `json:"storageLimit"`
	StorageUsage int64          `json:"storageUsage"`
	LastSyncAt   sql.NullString `json:"-"`
	CreatedAt    string         `json:"createdAt"`
	// RefreshToken is only populated by internal lookups, never serialized.
	RefreshToken string `json:"-"`
}

// ListDriveAccounts returns all linked accounts (newest first).
func (s *Store) ListDriveAccounts() ([]DriveAccount, error) {
	rows, err := s.DB.Query(
		`SELECT id, email, status, weight, folder_id, storage_limit, storage_usage,
		        last_sync_at, created_at
		 FROM drive_accounts ORDER BY created_at DESC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := []DriveAccount{}
	for rows.Next() {
		var a DriveAccount
		if err := rows.Scan(&a.ID, &a.Email, &a.Status, &a.Weight, &a.FolderID,
			&a.StorageLimit, &a.StorageUsage, &a.LastSyncAt, &a.CreatedAt); err != nil {
			return nil, err
		}
		items = append(items, a)
	}
	return items, rows.Err()
}

// DriveAccountByEmail looks up an account by email, including its refresh token.
func (s *Store) DriveAccountByEmail(email string) (*DriveAccount, error) {
	var a DriveAccount
	err := s.DB.QueryRow(
		`SELECT id, email, status, weight, folder_id, storage_limit, storage_usage,
		        last_sync_at, created_at, refresh_token
		 FROM drive_accounts WHERE email = ?`, email,
	).Scan(&a.ID, &a.Email, &a.Status, &a.Weight, &a.FolderID, &a.StorageLimit,
		&a.StorageUsage, &a.LastSyncAt, &a.CreatedAt, &a.RefreshToken)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	return &a, nil
}

// UpsertDriveAccount inserts or updates an account by email (re-linking reuses
// the row and refreshes the token + quota).
func (s *Store) UpsertDriveAccount(email, encryptedToken, folderID string, limit, usage int64) (string, error) {
	now := time.Now().UTC().Format(time.RFC3339)
	existing, err := s.DriveAccountByEmail(email)
	if err == nil {
		_, uerr := s.DB.Exec(
			`UPDATE drive_accounts SET refresh_token = ?, folder_id = ?, status = 'connected',
			        storage_limit = ?, storage_usage = ?, last_sync_at = ?, updated_at = ?
			 WHERE id = ?`,
			encryptedToken, folderID, limit, usage, now, now, existing.ID)
		return existing.ID, uerr
	}
	if !errors.Is(err, ErrNotFound) {
		return "", err
	}
	id := auth.NewID()
	_, ierr := s.DB.Exec(
		`INSERT INTO drive_accounts
		   (id, email, refresh_token, status, weight, folder_id, storage_limit, storage_usage, last_sync_at, created_at, updated_at)
		 VALUES (?, ?, ?, 'connected', 1, ?, ?, ?, ?, ?, ?)`,
		id, email, encryptedToken, folderID, limit, usage, now, now, now)
	return id, ierr
}

// UpdateDriveQuota refreshes the stored quota + status for an account.
func (s *Store) UpdateDriveQuota(id string, limit, usage int64, status string) error {
	_, err := s.DB.Exec(
		`UPDATE drive_accounts SET storage_limit = ?, storage_usage = ?, status = ?,
		        last_sync_at = ?, updated_at = ? WHERE id = ?`,
		limit, usage, status, time.Now().UTC().Format(time.RFC3339),
		time.Now().UTC().Format(time.RFC3339), id)
	return err
}

// SetDriveAccountWeight updates an account's balancing weight.
func (s *Store) SetDriveAccountWeight(id string, weight int) error {
	_, err := s.DB.Exec(
		`UPDATE drive_accounts SET weight = ?, updated_at = ? WHERE id = ?`,
		weight, time.Now().UTC().Format(time.RFC3339), id)
	return err
}

// DeleteDriveAccount removes a linked account.
func (s *Store) DeleteDriveAccount(id string) error {
	_, err := s.DB.Exec(`DELETE FROM drive_accounts WHERE id = ?`, id)
	return err
}

// DriveAccountByID returns one account (with refresh token) by id.
func (s *Store) DriveAccountByID(id string) (*DriveAccount, error) {
	var a DriveAccount
	err := s.DB.QueryRow(
		`SELECT id, email, status, weight, folder_id, storage_limit, storage_usage,
		        last_sync_at, created_at, refresh_token
		 FROM drive_accounts WHERE id = ?`, id,
	).Scan(&a.ID, &a.Email, &a.Status, &a.Weight, &a.FolderID, &a.StorageLimit,
		&a.StorageUsage, &a.LastSyncAt, &a.CreatedAt, &a.RefreshToken)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	return &a, nil
}
