// Package s3 implements an S3-compatible API whose storage backend is Google
// Drive. Object bytes are streamed to/from the linked Drive accounts; only
// metadata lives in SQLite. Nothing touches the local filesystem.
package s3

import (
	"bufio"
	"context"
	"crypto/md5"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"strconv"
	"time"

	"g3/internal/crypto"
	"g3/internal/drive"
	"g3/internal/store"
)

func todayUTC() string { return time.Now().UTC().Format("2006-01-02") }

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
	today := todayUTC()
	candidates := make([]store.DriveAccount, 0, len(all))
	for _, a := range all {
		if a.Status != "connected" || a.Weight <= 0 {
			continue
		}
		if a.StorageLimit > 0 && a.StorageUsage >= a.StorageLimit {
			continue
		}
		// Respect Google Drive's 750 GB/day per-account upload cap.
		if a.DailyDate.Valid && a.DailyDate.String == today && a.DailyBytes >= store.DailyUploadLimit {
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

// chunkSize bounds how many bytes go to a single Drive file. Objects larger
// than this are split into chunks spread across accounts by the balancer,
// which distributes both storage and the 750 GB/day upload cap.
const chunkSize int64 = 64 << 20 // 64 MiB

// PutObject streams body to Drive, chunking large objects across accounts. The
// ETag is always the MD5 of the whole object (computed inline), so single-call
// PUTs validate correctly regardless of internal chunking. Any prior version's
// Drive file(s) are deleted afterward.
func (s *Server) PutObject(ctx context.Context, bucket *store.Bucket, key, contentType string, body io.Reader) (string, error) {
	full := md5.New()
	br := bufio.NewReaderSize(body, 1<<20)

	var manifest []manifestPart
	var total int64

	for {
		// Stop once the body is exhausted (but always write at least one part,
		// so a zero-byte object still gets a backing file).
		if _, err := br.Peek(1); err == io.EOF && len(manifest) > 0 {
			break
		} else if err != nil && err != io.EOF {
			return "", err
		}

		acc, refresh, err := s.pickAccount(key)
		if err != nil {
			return "", err
		}
		folderID := ""
		if acc.FolderID.Valid {
			folderID = acc.FolderID.String
		}

		chunkHash := md5.New()
		counter := &countingReader{r: io.TeeReader(
			io.LimitReader(br, chunkSize), io.MultiWriter(full, chunkHash))}

		name := fmt.Sprintf("%s.part%d", key, len(manifest))
		fileID, err := s.drive.Upload(ctx, refresh, folderID, name, contentType, counter)
		if err != nil {
			return "", err
		}
		manifest = append(manifest, manifestPart{
			AccountID: acc.ID, DriveFileID: fileID, Size: counter.n,
			ETag: hex.EncodeToString(chunkHash.Sum(nil)),
		})
		total += counter.n
		s.store.AddDailyUsage(acc.ID, counter.n, todayUTC())

		if counter.n < chunkSize {
			break // short read => last chunk
		}
	}

	etag := hex.EncodeToString(full.Sum(nil))
	prior, _ := s.store.ObjectByKey(bucket.ID, key)

	var err error
	if len(manifest) == 1 {
		p := manifest[0]
		err = s.store.PutSingleObject(bucket.ID, key, total, etag, contentType, p.AccountID, p.DriveFileID)
	} else {
		blob, _ := json.Marshal(manifest)
		err = s.store.PutMultipartObject(bucket.ID, key, total, etag, contentType, string(blob))
	}
	if err != nil {
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
