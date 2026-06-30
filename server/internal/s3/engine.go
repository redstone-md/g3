// Package s3 implements an S3-compatible API whose storage backend is Google
// Drive. Object bytes are streamed to/from the linked Drive accounts; only
// metadata lives in SQLite. Nothing touches the local filesystem.
package s3

import (
	"context"
	"crypto/md5"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"strconv"

	"g3/internal/crypto"
	"g3/internal/drive"
	"g3/internal/store"
)

const balancingKey = "balancing_strategy"
const rrCursorKey = "balancing_rr_cursor"

// Server holds the dependencies shared by the S3 engine and HTTP handlers.
type Server struct {
	store  *store.Store
	drive  *drive.Manager
	cipher *crypto.Cipher
}

// New builds an S3 Server.
func New(st *store.Store, dr *drive.Manager, cph *crypto.Cipher) *Server {
	return &Server{store: st, drive: dr, cipher: cph}
}

// refreshFor decrypts an account's stored refresh token.
func (s *Server) refreshFor(acc *store.DriveAccount) (string, error) {
	return s.cipher.Decrypt(acc.RefreshToken)
}

// pickAccount selects a Drive account for a new upload per the configured
// balancing strategy, skipping disconnected or full accounts.
func (s *Server) pickAccount(key string) (*store.DriveAccount, string, error) {
	all, err := s.store.ListDriveAccounts()
	if err != nil {
		return nil, "", err
	}
	candidates := make([]store.DriveAccount, 0, len(all))
	for _, a := range all {
		if a.Status != "connected" || a.Weight <= 0 {
			continue
		}
		if a.StorageLimit > 0 && a.StorageUsage >= a.StorageLimit {
			continue
		}
		candidates = append(candidates, a)
	}
	if len(candidates) == 0 {
		return nil, "", errors.New("no available Drive account in the pool")
	}

	strategy := s.store.GetSetting(balancingKey, "round_robin")
	chosen := s.choose(strategy, key, candidates)

	full, err := s.store.DriveAccountByID(chosen.ID)
	if err != nil {
		return nil, "", err
	}
	refresh, err := s.refreshFor(full)
	if err != nil {
		return nil, "", err
	}
	return full, refresh, nil
}

func (s *Server) choose(strategy, key string, c []store.DriveAccount) store.DriveAccount {
	switch strategy {
	case "least_used":
		best := c[0]
		for _, a := range c[1:] {
			if free(a) > free(best) {
				best = a
			}
		}
		return best
	case "fill_first":
		// Accounts are returned newest-first; fill the oldest with space first.
		best := c[0]
		for _, a := range c[1:] {
			if a.CreatedAt < best.CreatedAt {
				best = a
			}
		}
		return best
	case "hash":
		h := 0
		for _, b := range []byte(key) {
			h = (h*31 + int(b)) & 0x7fffffff
		}
		return c[h%len(c)]
	default: // round_robin
		cursor, _ := strconv.Atoi(s.store.GetSetting(rrCursorKey, "0"))
		pick := c[cursor%len(c)]
		_ = s.store.SetSetting(rrCursorKey, strconv.Itoa((cursor+1)%1_000_000))
		return pick
	}
}

func free(a store.DriveAccount) int64 {
	if a.StorageLimit <= 0 {
		return 1 << 62 // treat unlimited as effectively infinite
	}
	return a.StorageLimit - a.StorageUsage
}

// countingReader counts bytes read through it (to record object size).
type countingReader struct {
	r io.Reader
	n int64
}

func (c *countingReader) Read(p []byte) (int, error) {
	n, err := c.r.Read(p)
	c.n += int64(n)
	return n, err
}

// PutObject streams body to a balancer-chosen Drive account, computes the MD5
// ETag inline, records metadata, and deletes any prior version's Drive file.
func (s *Server) PutObject(ctx context.Context, bucket *store.Bucket, key, contentType string, body io.Reader) (string, error) {
	acc, refresh, err := s.pickAccount(key)
	if err != nil {
		return "", err
	}
	folderID := ""
	if acc.FolderID.Valid {
		folderID = acc.FolderID.String
	}

	hasher := md5.New()
	counter := &countingReader{r: io.TeeReader(body, hasher)}

	fileID, err := s.drive.Upload(ctx, refresh, folderID, key, contentType, counter)
	if err != nil {
		return "", err
	}
	etag := hex.EncodeToString(hasher.Sum(nil))

	prior, _ := s.store.ObjectByKey(bucket.ID, key)
	if err := s.store.PutSingleObject(bucket.ID, key, counter.n, etag, contentType, acc.ID, fileID); err != nil {
		return "", err
	}
	if prior != nil {
		s.deleteBackingFiles(ctx, prior)
	}
	return etag, nil
}

// GetReader opens an object's bytes, honoring an optional HTTP Range header.
// For single-part objects it returns Drive's response (status, headers, body);
// for multipart objects it returns a stitched reader (see multipart.go).
func (s *Server) deleteBackingFiles(ctx context.Context, o *store.ObjectRow) {
	if o.IsMultipart {
		for _, p := range parsePartsManifest(o.Parts) {
			if acc, err := s.store.DriveAccountByID(p.AccountID); err == nil {
				if refresh, derr := s.refreshFor(acc); derr == nil {
					_ = s.drive.Delete(ctx, refresh, p.DriveFileID)
				}
			}
		}
		return
	}
	if o.AccountID.Valid && o.DriveFileID.Valid {
		if acc, err := s.store.DriveAccountByID(o.AccountID.String); err == nil {
			if refresh, derr := s.refreshFor(acc); derr == nil {
				_ = s.drive.Delete(ctx, refresh, o.DriveFileID.String)
			}
		}
	}
}

// DeleteObject removes an object's metadata and its Drive backing file(s).
func (s *Server) DeleteObject(ctx context.Context, bucket *store.Bucket, key string) error {
	o, err := s.store.ObjectByKey(bucket.ID, key)
	if errors.Is(err, store.ErrNotFound) {
		return nil // S3 delete is idempotent
	}
	if err != nil {
		return err
	}
	s.deleteBackingFiles(ctx, o)
	return s.store.DeleteObject(bucket.ID, key)
}

func driveNameForPart(uploadID string, part int) string {
	return fmt.Sprintf("g3-part-%s-%d", uploadID, part)
}
