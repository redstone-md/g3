package store

import (
	"database/sql"
	"errors"
	"time"

	"g3/internal/auth"
)

// MultipartUpload is an in-progress multipart upload.
type MultipartUpload struct {
	UploadID    string
	BucketID    string
	Key         string
	ContentType string
}

// MultipartPart is one uploaded part.
type MultipartPart struct {
	PartNumber  int
	AccountID   string
	DriveFileID string
	Size        int64
	ETag        string
}

func (s *Store) CreateMultipart(bucketID, key, contentType string) (string, error) {
	uploadID := auth.NewID() + auth.NewID()
	_, err := s.DB.Exec(
		`INSERT INTO multipart_uploads (upload_id, bucket_id, object_key, content_type, created_at)
		 VALUES (?, ?, ?, ?, ?)`,
		uploadID, bucketID, key, contentType, time.Now().UTC().Format(time.RFC3339))
	return uploadID, err
}

func (s *Store) MultipartByID(uploadID string) (*MultipartUpload, error) {
	var m MultipartUpload
	err := s.DB.QueryRow(
		`SELECT upload_id, bucket_id, object_key, content_type FROM multipart_uploads WHERE upload_id = ?`,
		uploadID,
	).Scan(&m.UploadID, &m.BucketID, &m.Key, &m.ContentType)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrNotFound
	}
	return &m, err
}

// PutPart records (or replaces) one uploaded part.
func (s *Store) PutPart(uploadID string, partNumber int, accountID, driveFileID string, size int64, etag string) error {
	_, err := s.DB.Exec(
		`INSERT INTO multipart_parts (upload_id, part_number, account_id, drive_file_id, size, etag)
		 VALUES (?, ?, ?, ?, ?, ?)
		 ON CONFLICT(upload_id, part_number) DO UPDATE SET
		   account_id=excluded.account_id, drive_file_id=excluded.drive_file_id,
		   size=excluded.size, etag=excluded.etag`,
		uploadID, partNumber, accountID, driveFileID, size, etag)
	return err
}

// ListParts returns a multipart upload's parts in order.
func (s *Store) ListParts(uploadID string) ([]MultipartPart, error) {
	rows, err := s.DB.Query(
		`SELECT part_number, account_id, drive_file_id, size, etag
		 FROM multipart_parts WHERE upload_id = ? ORDER BY part_number ASC`, uploadID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []MultipartPart{}
	for rows.Next() {
		var p MultipartPart
		if err := rows.Scan(&p.PartNumber, &p.AccountID, &p.DriveFileID, &p.Size, &p.ETag); err != nil {
			return nil, err
		}
		out = append(out, p)
	}
	return out, rows.Err()
}

// DeleteMultipart removes an upload and its parts (the Drive part-files are
// cleaned up by the caller, which knows their ids).
func (s *Store) DeleteMultipart(uploadID string) error {
	if _, err := s.DB.Exec(`DELETE FROM multipart_parts WHERE upload_id = ?`, uploadID); err != nil {
		return err
	}
	_, err := s.DB.Exec(`DELETE FROM multipart_uploads WHERE upload_id = ?`, uploadID)
	return err
}
