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
	Metadata    sql.NullString // JSON map of user metadata (x-amz-meta-*)
	IsMultipart bool
	CreatedAt   string
	UpdatedAt   string
}

// ObjectWrite describes an object version to persist. Exactly one backing
// form is filled in: AccountID+DriveFileID for a single Drive file, or
// PartsJSON for a manifest of parts.
type ObjectWrite struct {
	BucketID    string
	Key         string
	Size        int64
	ETag        string
	ContentType string
	Metadata    string // JSON map of user metadata; "" stores NULL
	AccountID   string
	DriveFileID string
	PartsJSON   string
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
		        drive_file_id, parts, metadata, is_multipart, created_at, updated_at
		 FROM objects WHERE bucket_id = ? AND object_key = ?`, bucketID, key,
	).Scan(&o.ID, &o.BucketID, &o.Key, &o.Size, &o.ETag, &o.ContentType, &o.AccountID,
		&o.DriveFileID, &o.Parts, &o.Metadata, &o.IsMultipart, &o.CreatedAt, &o.UpdatedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	return &o, nil
}

// PutObject upserts an object version, replacing any existing key. A manifest
// in PartsJSON marks the object multipart; otherwise the single-file columns
// are used. The two forms are mutually exclusive, so the unused columns are
// cleared on update rather than left pointing at the previous version.
func (s *Store) PutObject(o ObjectWrite) error {
	now := time.Now().UTC().Format(time.RFC3339)
	multipart := o.PartsJSON != ""
	_, err := s.DB.Exec(
		`INSERT INTO objects (id, bucket_id, object_key, size, etag, content_type,
		   metadata, account_id, drive_file_id, parts, is_multipart, created_at, updated_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		 ON CONFLICT(bucket_id, object_key) DO UPDATE SET
		   size=excluded.size, etag=excluded.etag, content_type=excluded.content_type,
		   metadata=excluded.metadata, account_id=excluded.account_id,
		   drive_file_id=excluded.drive_file_id, parts=excluded.parts,
		   is_multipart=excluded.is_multipart, updated_at=excluded.updated_at`,
		auth.NewID(), o.BucketID, o.Key, o.Size, o.ETag, o.ContentType,
		nullable(o.Metadata), nullable(o.AccountID), nullable(o.DriveFileID),
		nullable(o.PartsJSON), multipart, now, now)
	return err
}

// nullable stores empty strings as SQL NULL, keeping "absent" distinct from
// "empty" for the optional object columns.
func nullable(v string) any {
	if v == "" {
		return nil
	}
	return v
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
		        drive_file_id, parts, metadata, is_multipart, created_at, updated_at
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
			&o.AccountID, &o.DriveFileID, &o.Parts, &o.Metadata, &o.IsMultipart,
			&o.CreatedAt, &o.UpdatedAt); err != nil {
			return nil, err
		}
		out = append(out, o)
	}
	return out, rows.Err()
}
