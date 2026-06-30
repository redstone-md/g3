package store

import (
	"database/sql"
	"errors"
	"time"

	"g3/internal/auth"
)

// AccessKey is an S3 access key (the secret is stored encrypted, not here).
type AccessKey struct {
	ID          string         `json:"id"`
	AccessKeyID string         `json:"accessKeyId"`
	Label       sql.NullString `json:"-"`
	CreatedAt   string         `json:"createdAt"`
	LastUsedAt  sql.NullString `json:"-"`
}

func (s *Store) ListAccessKeys() ([]AccessKey, error) {
	rows, err := s.DB.Query(
		`SELECT id, access_key_id, label, created_at, last_used_at
		 FROM s3_access_keys ORDER BY created_at DESC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []AccessKey{}
	for rows.Next() {
		var k AccessKey
		if err := rows.Scan(&k.ID, &k.AccessKeyID, &k.Label, &k.CreatedAt, &k.LastUsedAt); err != nil {
			return nil, err
		}
		out = append(out, k)
	}
	return out, rows.Err()
}

// CreateAccessKey stores a new key. encSecret is the encrypted secret.
func (s *Store) CreateAccessKey(accessKeyID, encSecret, label string) (string, error) {
	id := auth.NewID()
	var labelArg any
	if label != "" {
		labelArg = label
	}
	_, err := s.DB.Exec(
		`INSERT INTO s3_access_keys (id, access_key_id, secret_hash, label, created_at)
		 VALUES (?, ?, ?, ?, ?)`,
		id, accessKeyID, encSecret, labelArg, time.Now().UTC().Format(time.RFC3339))
	return id, err
}

// AccessKeySecret returns the encrypted secret for an access key id.
func (s *Store) AccessKeySecret(accessKeyID string) (string, error) {
	var enc string
	err := s.DB.QueryRow(
		`SELECT secret_hash FROM s3_access_keys WHERE access_key_id = ?`, accessKeyID).Scan(&enc)
	if errors.Is(err, sql.ErrNoRows) {
		return "", ErrNotFound
	}
	return enc, err
}

// TouchAccessKey records last use (best-effort).
func (s *Store) TouchAccessKey(accessKeyID string) {
	_, _ = s.DB.Exec(`UPDATE s3_access_keys SET last_used_at = ? WHERE access_key_id = ?`,
		time.Now().UTC().Format(time.RFC3339), accessKeyID)
}

func (s *Store) DeleteAccessKey(id string) error {
	_, err := s.DB.Exec(`DELETE FROM s3_access_keys WHERE id = ?`, id)
	return err
}

// HasAccessKeys reports whether any S3 access key exists.
func (s *Store) HasAccessKeys() (bool, error) {
	var n int
	err := s.DB.QueryRow(`SELECT COUNT(*) FROM s3_access_keys`).Scan(&n)
	return n > 0, err
}
