package s3

import (
	"context"
	"crypto/md5"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"

	"g3/internal/store"
)

// manifestPart is one stored part of a completed multipart object.
type manifestPart struct {
	AccountID   string `json:"a"`
	DriveFileID string `json:"f"`
	Size        int64  `json:"s"`
	ETag        string `json:"e"`
}

func parsePartsManifest(ns sql.NullString) []manifestPart {
	if !ns.Valid {
		return nil
	}
	return parseManifestJSON(ns.String)
}

// parseManifestJSON decodes a stored parts manifest. A blob that fails to
// parse yields no parts, which keeps callers (including the garbage
// collector) from acting on a half-read manifest.
func parseManifestJSON(blob string) []manifestPart {
	if blob == "" {
		return nil
	}
	var parts []manifestPart
	if err := json.Unmarshal([]byte(blob), &parts); err != nil {
		return nil
	}
	return parts
}

// marshalManifest encodes a manifest for the object's parts column.
func marshalManifest(parts []manifestPart) string {
	blob, err := json.Marshal(parts)
	if err != nil {
		return ""
	}
	return string(blob)
}

// InitiateMultipart starts a multipart upload and returns its id. metadata is
// the JSON blob of x-amz-meta-* headers, applied to the object on completion.
func (s *Server) InitiateMultipart(bucket *store.Bucket, key, contentType, metadata string) (string, error) {
	return s.store.CreateMultipart(bucket.ID, key, contentType, metadata)
}

// UploadPart streams one part to a balancer-chosen account and records it.
func (s *Server) UploadPart(ctx context.Context, mu *store.MultipartUpload, partNumber int, body io.Reader) (string, error) {
	acc, refresh, err := s.pickAccount(mu.Key)
	if err != nil {
		return "", err
	}
	folderID := ""
	if acc.FolderID.Valid {
		folderID = acc.FolderID.String
	}
	hasher := md5.New()
	counter := &countingReader{r: io.TeeReader(body, hasher)}

	fileID, err := s.drive.Upload(ctx, refresh, folderID,
		driveNameForPart(mu.UploadID, partNumber), "application/octet-stream", counter)
	if err != nil {
		return "", err
	}
	etag := hex.EncodeToString(hasher.Sum(nil))
	staged := []manifestPart{{AccountID: acc.ID, DriveFileID: fileID}}
	if err := s.store.PutPart(mu.UploadID, partNumber, acc.ID, fileID, counter.n, etag); err != nil {
		return "", s.abandon(ctx, staged, err)
	}
	s.store.AddDailyUsage(acc.ID, counter.n, todayUTC())
	return etag, nil
}

// CompleteMultipart assembles parts into a single object. The ETag follows the
// S3 multipart convention: md5(concatenated part-md5 bytes) + "-" + partCount.
func (s *Server) CompleteMultipart(ctx context.Context, bucket *store.Bucket, mu *store.MultipartUpload) (string, int64, error) {
	parts, err := s.store.ListParts(mu.UploadID)
	if err != nil {
		return "", 0, err
	}
	if len(parts) == 0 {
		return "", 0, fmt.Errorf("no parts uploaded")
	}

	manifest := make([]manifestPart, 0, len(parts))
	concat := md5.New()
	var total int64
	for _, p := range parts {
		raw, derr := hex.DecodeString(p.ETag)
		if derr == nil {
			concat.Write(raw)
		}
		total += p.Size
		manifest = append(manifest, manifestPart{
			AccountID: p.AccountID, DriveFileID: p.DriveFileID, Size: p.Size, ETag: p.ETag,
		})
	}
	etag := fmt.Sprintf("%s-%d", hex.EncodeToString(concat.Sum(nil)), len(parts))

	prior, _ := s.store.ObjectByKey(bucket.ID, mu.Key)
	if err := s.store.PutObject(store.ObjectWrite{
		BucketID: bucket.ID, Key: mu.Key, Size: total, ETag: etag,
		ContentType: mu.ContentType, Metadata: mu.Metadata.String,
		PartsJSON: marshalManifest(manifest),
	}); err != nil {
		return "", 0, err
	}
	if prior != nil {
		s.deleteBackingFiles(ctx, prior)
	}
	// Drop the staging rows (Drive part-files are now owned by the object).
	_ = s.store.DeleteMultipart(mu.UploadID)
	return etag, total, nil
}

// AbortMultipart deletes staged parts (metadata + Drive files).
func (s *Server) AbortMultipart(ctx context.Context, mu *store.MultipartUpload) error {
	parts, err := s.store.ListParts(mu.UploadID)
	if err != nil {
		return err
	}
	staged := make([]manifestPart, 0, len(parts))
	for _, p := range parts {
		staged = append(staged, manifestPart{AccountID: p.AccountID, DriveFileID: p.DriveFileID})
	}
	s.deleteManifest(ctx, staged)
	return s.store.DeleteMultipart(mu.UploadID)
}

// segment is the byte range of one part that overlaps the requested range.
type segment struct {
	accountID, fileID string
	from, to          int64
}

// openMultipartRange returns a reader that lazily streams the byte range
// [start, end] across the manifest's parts (end == -1 means to EOF). Each
// part's Drive download is opened only when the reader reaches it, so the
// first byte arrives after one round-trip and connections are held one at a
// time. The caller must Close the reader.
func (s *Server) openMultipartRange(ctx context.Context, parts []manifestPart, start, end int64) (io.ReadCloser, error) {
	if end < 0 {
		var total int64
		for _, p := range parts {
			total += p.Size
		}
		end = total - 1
	}
	var segs []segment
	var cursor int64
	for _, p := range parts {
		partStart, partEnd := cursor, cursor+p.Size-1
		cursor += p.Size
		if partEnd < start || partStart > end {
			continue
		}
		from := int64(0)
		if start > partStart {
			from = start - partStart
		}
		to := p.Size - 1
		if end < partEnd {
			to = end - partStart
		}
		segs = append(segs, segment{accountID: p.AccountID, fileID: p.DriveFileID, from: from, to: to})
	}
	return &lazyMultipartReader{srv: s, ctx: ctx, segs: segs, tokens: map[string]string{}}, nil
}

// lazyMultipartReader streams parts on demand, opening the next part's Drive
// download only when the current one is exhausted.
type lazyMultipartReader struct {
	srv    *Server
	ctx    context.Context
	segs   []segment
	idx    int
	cur    io.ReadCloser
	tokens map[string]string
}

func (l *lazyMultipartReader) refresh(accountID string) (string, error) {
	if r, ok := l.tokens[accountID]; ok {
		return r, nil
	}
	acc, err := l.srv.store.DriveAccountByID(accountID)
	if err != nil {
		return "", err
	}
	r, err := l.srv.refreshFor(acc)
	if err != nil {
		return "", err
	}
	l.tokens[accountID] = r
	return r, nil
}

func (l *lazyMultipartReader) Read(p []byte) (int, error) {
	for {
		if l.cur == nil {
			if l.idx >= len(l.segs) {
				return 0, io.EOF
			}
			seg := l.segs[l.idx]
			l.idx++
			refresh, err := l.refresh(seg.accountID)
			if err != nil {
				return 0, err
			}
			resp, err := l.srv.drive.Download(l.ctx, refresh, seg.fileID,
				fmt.Sprintf("bytes=%d-%d", seg.from, seg.to))
			if err != nil {
				return 0, err
			}
			l.cur = resp.Body
		}
		n, err := l.cur.Read(p)
		if err == io.EOF {
			_ = l.cur.Close()
			l.cur = nil
			if n > 0 {
				return n, nil
			}
			continue // move to the next segment
		}
		return n, err
	}
}

func (l *lazyMultipartReader) Close() error {
	if l.cur != nil {
		return l.cur.Close()
	}
	return nil
}
