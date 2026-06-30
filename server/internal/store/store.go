// Package store owns the embedded SQLite metadata database: schema, first-run
// seed, and all queries. Nothing is stored on the local filesystem except this
// single DB file; object bytes live on Google Drive (added in later phases).
package store

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"time"

	_ "modernc.org/sqlite"

	"g3/internal/auth"
)

// Store wraps the database handle and exposes typed queries.
type Store struct {
	DB *sql.DB
}

const schema = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  password_hash TEXT NOT NULL,
  must_change_password INTEGER NOT NULL DEFAULT 0,
  theme TEXT NOT NULL DEFAULT 'modern-minimal',
  motion TEXT NOT NULL DEFAULT 'smooth',
  locale TEXT NOT NULL DEFAULT 'ru',
  avatar TEXT,
  notifications_enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS roles (
  id TEXT PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  description TEXT,
  permissions TEXT NOT NULL DEFAULT '[]',
  parent_ids TEXT NOT NULL DEFAULT '[]',
  is_system INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS user_roles (
  user_id TEXT NOT NULL,
  role_id TEXT NOT NULL,
  PRIMARY KEY (user_id, role_id)
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  token_hash TEXT UNIQUE NOT NULL,
  user_id TEXT NOT NULL,
  user_agent TEXT,
  ip TEXT,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

CREATE TABLE IF NOT EXISTS audit_log (
  id TEXT PRIMARY KEY,
  action TEXT NOT NULL,
  actor_id TEXT,
  actor_email TEXT,
  target_type TEXT,
  target_id TEXT,
  metadata TEXT,
  ip TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at DESC);

-- Google Drive storage backends. The refresh token is stored encrypted
-- (AES-GCM); object bytes live in each account's Drive, never on local disk.
CREATE TABLE IF NOT EXISTS drive_accounts (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  refresh_token TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'connected',
  weight INTEGER NOT NULL DEFAULT 1,
  folder_id TEXT,
  storage_limit INTEGER NOT NULL DEFAULT 0,
  storage_usage INTEGER NOT NULL DEFAULT 0,
  last_sync_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- S3 buckets (logical namespaces; bytes live on Drive).
CREATE TABLE IF NOT EXISTS buckets (
  id TEXT PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  created_at TEXT NOT NULL
);

-- S3 objects. A single-part object maps to one Drive file on one account;
-- a multipart object keeps a JSON manifest of its parts (parts column).
CREATE TABLE IF NOT EXISTS objects (
  id TEXT PRIMARY KEY,
  bucket_id TEXT NOT NULL,
  object_key TEXT NOT NULL,
  size INTEGER NOT NULL DEFAULT 0,
  etag TEXT NOT NULL,
  content_type TEXT NOT NULL DEFAULT 'application/octet-stream',
  account_id TEXT,
  drive_file_id TEXT,
  parts TEXT,
  is_multipart INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (bucket_id, object_key)
);
CREATE INDEX IF NOT EXISTS idx_objects_bucket_key ON objects(bucket_id, object_key);

-- In-progress multipart uploads and their parts.
CREATE TABLE IF NOT EXISTS multipart_uploads (
  upload_id TEXT PRIMARY KEY,
  bucket_id TEXT NOT NULL,
  object_key TEXT NOT NULL,
  content_type TEXT NOT NULL DEFAULT 'application/octet-stream',
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS multipart_parts (
  upload_id TEXT NOT NULL,
  part_number INTEGER NOT NULL,
  account_id TEXT NOT NULL,
  drive_file_id TEXT NOT NULL,
  size INTEGER NOT NULL,
  etag TEXT NOT NULL,
  PRIMARY KEY (upload_id, part_number)
);

-- S3 access keys for SigV4 authentication.
CREATE TABLE IF NOT EXISTS s3_access_keys (
  id TEXT PRIMARY KEY,
  access_key_id TEXT UNIQUE NOT NULL,
  secret_hash TEXT NOT NULL,
  label TEXT,
  created_at TEXT NOT NULL,
  last_used_at TEXT
);

-- Key/value settings (e.g. balancing strategy).
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`

// Open creates (if needed) and opens the metadata DB, applies the schema, and
// seeds the first admin account.
func Open(dataDir, adminEmail, adminPassword string) (*Store, error) {
	if err := os.MkdirAll(dataDir, 0o755); err != nil {
		return nil, fmt.Errorf("create data dir: %w", err)
	}
	dsn := filepath.Join(dataDir, "g3.db") +
		"?_pragma=busy_timeout(5000)&_pragma=journal_mode(WAL)&_pragma=foreign_keys(ON)"

	db, err := sql.Open("sqlite", dsn)
	if err != nil {
		return nil, fmt.Errorf("open sqlite: %w", err)
	}
	db.SetMaxOpenConns(1) // modernc sqlite: serialize writes to avoid SQLITE_BUSY
	if _, err := db.Exec(schema); err != nil {
		return nil, fmt.Errorf("apply schema: %w", err)
	}

	s := &Store{DB: db}
	if err := s.seedAdmin(adminEmail, adminPassword); err != nil {
		return nil, fmt.Errorf("seed admin: %w", err)
	}
	if err := s.syncSystemAdminPermissions(); err != nil {
		return nil, fmt.Errorf("sync admin perms: %w", err)
	}
	return s, nil
}

// syncSystemAdminPermissions keeps every system role's permission set equal to
// the full catalog, so capabilities added in newer versions reach existing DBs.
func (s *Store) syncSystemAdminPermissions() error {
	perms, _ := json.Marshal(auth.AllPermissions)
	_, err := s.DB.Exec(
		`UPDATE roles SET permissions = ?, updated_at = ? WHERE is_system = 1`,
		string(perms), time.Now().UTC().Format(time.RFC3339))
	return err
}

// Close releases the database handle.
func (s *Store) Close() error { return s.DB.Close() }

// seedAdmin creates the Administrator role + admin user on a fresh database.
func (s *Store) seedAdmin(email, password string) error {
	var count int
	if err := s.DB.QueryRow(`SELECT COUNT(*) FROM users`).Scan(&count); err != nil {
		return err
	}
	if count > 0 {
		return nil
	}

	now := time.Now().UTC().Format(time.RFC3339)
	perms, _ := json.Marshal(auth.AllPermissions)

	roleID := auth.NewID()
	if _, err := s.DB.Exec(
		`INSERT INTO roles (id, name, description, permissions, parent_ids, is_system, created_at, updated_at)
		 VALUES (?, ?, ?, ?, '[]', 1, ?, ?)`,
		roleID, "Administrator", "Full access to every G3 capability.", string(perms), now, now,
	); err != nil {
		return err
	}

	hash, err := auth.HashPassword(password)
	if err != nil {
		return err
	}
	userID := auth.NewID()
	if _, err := s.DB.Exec(
		`INSERT INTO users (id, email, name, password_hash, must_change_password, created_at, updated_at)
		 VALUES (?, ?, ?, ?, 1, ?, ?)`,
		userID, email, "Administrator", hash, now, now,
	); err != nil {
		return err
	}
	if _, err := s.DB.Exec(
		`INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)`, userID, roleID,
	); err != nil {
		return err
	}

	fmt.Printf("[g3] seeded admin account: %s (must change password on first login)\n", email)
	return nil
}
