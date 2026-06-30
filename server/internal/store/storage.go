package store

import (
	"database/sql"
	"errors"
	"time"

	"g3/internal/auth"
)

// Bucket is an S3 bucket (a logical namespace).
type Bucket struct {
	ID        string
	Name      string
	CreatedAt string
}

// ObjectRow is a stored S3 object. Single-part objects carry AccountID +
// DriveFileID; multipart objects carry a JSON parts manifest instead.
type ObjectRow struct {
	ID          string
	BucketID    string
	Key         string
	Size        int64
	ETag        string
	ContentType string
	AccountID   sql.NullString
	DriveFileID sql.NullString
	Parts       sql.NullString
	IsMultipart bool
	CreatedAt   string
	UpdatedAt   string
}

// --- buckets ---

func (s *Store) ListBuckets() ([]Bucket, error) {
	rows, err := s.DB.Query(`SELECT id, name, created_at FROM buckets ORDER BY name`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []Bucket{}
	for rows.Next() {
		var b Bucket
		if err := rows.Scan(&b.ID, &b.Name, &b.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, b)
	}
	return out, rows.Err()
}

func (s *Store) BucketByName(name string) (*Bucket, error) {
	var b Bucket
	err := s.DB.QueryRow(`SELECT id, name, created_at FROM buckets WHERE name = ?`, name).
		Scan(&b.ID, &b.Name, &b.CreatedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrNotFound
	}
	return &b, err
}

func (s *Store) BucketByID(id string) (*Bucket, error) {
	var b Bucket
	err := s.DB.QueryRow(`SELECT id, name, created_at FROM buckets WHERE id = ?`, id).
		Scan(&b.ID, &b.Name, &b.CreatedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrNotFound
	}
	return &b, err
}

func (s *Store) CreateBucket(name string) (string, error) {
	id := auth.NewID()
	_, err := s.DB.Exec(`INSERT INTO buckets (id, name, created_at) VALUES (?, ?, ?)`,
		id, name, time.Now().UTC().Format(time.RFC3339))
	return id, err
}

func (s *Store) BucketObjectCount(bucketID string) (int, error) {
	var n int
	err := s.DB.QueryRow(`SELECT COUNT(*) FROM objects WHERE bucket_id = ?`, bucketID).Scan(&n)
	return n, err
}

func (s *Store) DeleteBucket(id string) error {
	_, err := s.DB.Exec(`DELETE FROM buckets WHERE id = ?`, id)
	return err
}

// --- objects ---

func (s *Store) ObjectByKey(bucketID, key string) (*ObjectRow, error) {
	var o ObjectRow
	err := s.DB.QueryRow(
		`SELECT id, bucket_id, object_key, size, etag, content_type, account_id,
		        drive_file_id, parts, is_multipart, created_at, updated_at
		 FROM objects WHERE bucket_id = ? AND object_key = ?`, bucketID, key,
	).Scan(&o.ID, &o.BucketID, &o.Key, &o.Size, &o.ETag, &o.ContentType, &o.AccountID,
		&o.DriveFileID, &o.Parts, &o.IsMultipart, &o.CreatedAt, &o.UpdatedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	return &o, nil
}

// PutSingleObject upserts a single-part object (replacing any existing key).
func (s *Store) PutSingleObject(bucketID, key string, size int64, etag, contentType, accountID, driveFileID string) error {
	now := time.Now().UTC().Format(time.RFC3339)
	_, err := s.DB.Exec(
		`INSERT INTO objects (id, bucket_id, object_key, size, etag, content_type,
		   account_id, drive_file_id, parts, is_multipart, created_at, updated_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, 0, ?, ?)
		 ON CONFLICT(bucket_id, object_key) DO UPDATE SET
		   size=excluded.size, etag=excluded.etag, content_type=excluded.content_type,
		   account_id=excluded.account_id, drive_file_id=excluded.drive_file_id,
		   parts=NULL, is_multipart=0, updated_at=excluded.updated_at`,
		auth.NewID(), bucketID, key, size, etag, contentType, accountID, driveFileID, now, now)
	return err
}

// PutMultipartObject upserts a multipart object with a JSON parts manifest.
func (s *Store) PutMultipartObject(bucketID, key string, size int64, etag, contentType, partsJSON string) error {
	now := time.Now().UTC().Format(time.RFC3339)
	_, err := s.DB.Exec(
		`INSERT INTO objects (id, bucket_id, object_key, size, etag, content_type,
		   account_id, drive_file_id, parts, is_multipart, created_at, updated_at)
		 VALUES (?, ?, ?, ?, ?, ?, NULL, NULL, ?, 1, ?, ?)
		 ON CONFLICT(bucket_id, object_key) DO UPDATE SET
		   size=excluded.size, etag=excluded.etag, content_type=excluded.content_type,
		   account_id=NULL, drive_file_id=NULL, parts=excluded.parts, is_multipart=1,
		   updated_at=excluded.updated_at`,
		auth.NewID(), bucketID, key, size, etag, contentType, partsJSON, now, now)
	return err
}

func (s *Store) DeleteObject(bucketID, key string) error {
	_, err := s.DB.Exec(`DELETE FROM objects WHERE bucket_id = ? AND object_key = ?`, bucketID, key)
	return err
}

// ListObjects returns objects under a prefix, lexicographically after `after`,
// capped at limit+1 so the caller can detect truncation.
func (s *Store) ListObjects(bucketID, prefix, after string, limit int) ([]ObjectRow, error) {
	rows, err := s.DB.Query(
		`SELECT id, bucket_id, object_key, size, etag, content_type, account_id,
		        drive_file_id, parts, is_multipart, created_at, updated_at
		 FROM objects
		 WHERE bucket_id = ? AND object_key LIKE ? || '%' AND object_key > ?
		 ORDER BY object_key ASC LIMIT ?`,
		bucketID, prefix, after, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []ObjectRow{}
	for rows.Next() {
		var o ObjectRow
		if err := rows.Scan(&o.ID, &o.BucketID, &o.Key, &o.Size, &o.ETag, &o.ContentType,
			&o.AccountID, &o.DriveFileID, &o.Parts, &o.IsMultipart, &o.CreatedAt, &o.UpdatedAt); err != nil {
			return nil, err
		}
		out = append(out, o)
	}
	return out, rows.Err()
}
