package s3

import (
	"errors"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"

	"g3/internal/store"
)

// ServeHTTP authenticates the request (SigV4, header or presigned query) and
// dispatches the S3 operation.
func (s *Server) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	cred, ok := s.authenticate(w, r)
	if !ok {
		return
	}
	s.store.TouchAccessKey(cred.accessKeyID)

	bucketName, key := splitPath(r.URL.Path)
	switch {
	case bucketName == "":
		if r.Method == http.MethodGet {
			s.listBuckets(w, r)
			return
		}
		writeS3Error(w, http.StatusMethodNotAllowed, "MethodNotAllowed", "", r.URL.Path)
	case key == "":
		s.bucketOp(w, r, bucketName)
	default:
		s.objectOp(w, r, bucketName, key)
	}
}

// authenticate verifies SigV4 via the Authorization header or, failing that, a
// presigned query string. On failure it writes the S3 error and returns false.
func (s *Server) authenticate(w http.ResponseWriter, r *http.Request) (*credential, bool) {
	presigned := false
	cred, err := parseAuthorization(r.Header.Get("Authorization"))
	if err != nil {
		var pok bool
		cred, pok = parsePresignedQuery(r.URL.Query())
		if !pok {
			writeS3Error(w, http.StatusForbidden, "AccessDenied", "Missing SigV4 credentials", r.URL.Path)
			return nil, false
		}
		presigned = true
	}

	enc, err := s.store.AccessKeySecret(cred.accessKeyID)
	if err != nil {
		writeS3Error(w, http.StatusForbidden, "InvalidAccessKeyId", "Unknown access key", r.URL.Path)
		return nil, false
	}
	secret, err := s.cipher.Decrypt(enc)
	if err != nil {
		writeS3Error(w, http.StatusForbidden, "SignatureDoesNotMatch", "Signature mismatch", r.URL.Path)
		return nil, false
	}

	if presigned {
		valid, expired := verifyPresigned(r, cred, secret)
		if expired {
			writeS3Error(w, http.StatusForbidden, "AccessDenied", "Request has expired", r.URL.Path)
			return nil, false
		}
		if !valid {
			writeS3Error(w, http.StatusForbidden, "SignatureDoesNotMatch", "Signature mismatch", r.URL.Path)
			return nil, false
		}
		return cred, true
	}

	if !verifyV4(r, cred, secret) {
		writeS3Error(w, http.StatusForbidden, "SignatureDoesNotMatch", "Signature mismatch", r.URL.Path)
		return nil, false
	}
	return cred, true
}

// ServeObject streams an object (or an S3 error) to w. Used by the panel file
// manager for in-browser download/preview (separate from the SigV4 S3 API).
func (s *Server) ServeObject(w http.ResponseWriter, r *http.Request, b *store.Bucket, key string) {
	s.getObject(w, r, b, key, true)
}

func splitPath(p string) (bucket, key string) {
	p = strings.TrimPrefix(p, "/")
	if p == "" {
		return "", ""
	}
	if i := strings.IndexByte(p, '/'); i >= 0 {
		return p[:i], p[i+1:]
	}
	return p, ""
}

func quote(etag string) string { return `"` + etag + `"` }

// --- bucket-level ---

func (s *Server) listBuckets(w http.ResponseWriter, _ *http.Request) {
	buckets, err := s.store.ListBuckets()
	if err != nil {
		writeS3Error(w, http.StatusInternalServerError, "InternalError", err.Error(), "/")
		return
	}
	out := listAllBuckets{Owner: xmlOwner{ID: "g3", DisplayName: "g3"}}
	for _, b := range buckets {
		out.Buckets = append(out.Buckets, xmlBucket{Name: b.Name, CreationDate: b.CreatedAt})
	}
	writeXML(w, http.StatusOK, out)
}

func (s *Server) bucketOp(w http.ResponseWriter, r *http.Request, name string) {
	// Sub-resources (?acl, ?policy, ?location, ?versioning, …) come first so a
	// client's Properties/Permissions tabs don't receive an object listing.
	if sub, ok := detectBucketSub(r.URL.Query()); ok {
		s.handleBucketSub(w, r, name, sub)
		return
	}
	switch r.Method {
	case http.MethodPut:
		if _, err := s.store.BucketByName(name); err == nil {
			w.WriteHeader(http.StatusOK)
			return
		}
		if !validBucketName(name) {
			writeS3Error(w, http.StatusBadRequest, "InvalidBucketName", "Invalid bucket name", name)
			return
		}
		if _, err := s.store.CreateBucket(name); err != nil {
			writeS3Error(w, http.StatusInternalServerError, "InternalError", err.Error(), name)
			return
		}
		w.Header().Set("Location", "/"+name)
		w.WriteHeader(http.StatusOK)
	case http.MethodDelete:
		b, err := s.store.BucketByName(name)
		if err != nil {
			writeS3Error(w, http.StatusNotFound, "NoSuchBucket", "", name)
			return
		}
		if n, _ := s.store.BucketObjectCount(b.ID); n > 0 {
			writeS3Error(w, http.StatusConflict, "BucketNotEmpty", "The bucket is not empty", name)
			return
		}
		_ = s.store.DeleteBucket(b.ID)
		w.WriteHeader(http.StatusNoContent)
	case http.MethodHead:
		if _, err := s.store.BucketByName(name); err != nil {
			w.WriteHeader(http.StatusNotFound)
			return
		}
		w.WriteHeader(http.StatusOK)
	case http.MethodGet:
		s.listObjects(w, r, name)
	case http.MethodPost:
		if _, ok := r.URL.Query()["delete"]; ok {
			s.deleteObjects(w, r, name)
			return
		}
		writeS3Error(w, http.StatusMethodNotAllowed, "MethodNotAllowed", "", name)
	default:
		writeS3Error(w, http.StatusMethodNotAllowed, "MethodNotAllowed", "", name)
	}
}

func (s *Server) listObjects(w http.ResponseWriter, r *http.Request, name string) {
	b, err := s.store.BucketByName(name)
	if err != nil {
		writeS3Error(w, http.StatusNotFound, "NoSuchBucket", "", name)
		return
	}
	q := r.URL.Query()
	prefix := q.Get("prefix")
	maxKeys := 1000
	if v, err := strconv.Atoi(q.Get("max-keys")); err == nil && v > 0 && v < 1000 {
		maxKeys = v
	}
	after := q.Get("start-after")
	if tok := q.Get("continuation-token"); tok != "" {
		after = tok
	}

	rows, err := s.store.ListObjects(b.ID, prefix, after, maxKeys+1)
	if err != nil {
		writeS3Error(w, http.StatusInternalServerError, "InternalError", err.Error(), name)
		return
	}
	truncated := len(rows) > maxKeys
	if truncated {
		rows = rows[:maxKeys]
	}
	out := listBucketResult{
		Name: name, Prefix: prefix, MaxKeys: maxKeys,
		KeyCount: len(rows), IsTruncated: truncated,
	}
	for _, o := range rows {
		out.Contents = append(out.Contents, xmlObject{
			Key: o.Key, LastModified: o.UpdatedAt, ETag: quote(o.ETag),
			Size: o.Size, StorageClass: "STANDARD",
		})
	}
	if truncated && len(rows) > 0 {
		out.NextContinuationToken = rows[len(rows)-1].Key
	}
	writeXML(w, http.StatusOK, out)
}

func (s *Server) deleteObjects(w http.ResponseWriter, r *http.Request, name string) {
	b, err := s.store.BucketByName(name)
	if err != nil {
		writeS3Error(w, http.StatusNotFound, "NoSuchBucket", "", name)
		return
	}
	var req deleteRequest
	if err := decodeXML(r.Body, &req); err != nil {
		writeS3Error(w, http.StatusBadRequest, "MalformedXML", err.Error(), name)
		return
	}
	out := deleteResult{}
	for _, obj := range req.Objects {
		_ = s.DeleteObject(r.Context(), b, obj.Key)
		out.Deleted = append(out.Deleted, deletedEntry{Key: obj.Key})
	}
	writeXML(w, http.StatusOK, out)
}

// --- object-level ---

func (s *Server) objectOp(w http.ResponseWriter, r *http.Request, name, key string) {
	b, err := s.store.BucketByName(name)
	if err != nil {
		writeS3Error(w, http.StatusNotFound, "NoSuchBucket", "", name)
		return
	}
	q := r.URL.Query()

	if sub, ok := detectObjectSub(q); ok {
		s.handleObjectSub(w, r, b, key, sub)
		return
	}

	if _, ok := q["uploads"]; ok && r.Method == http.MethodPost {
		s.initiateMultipart(w, r, b, key)
		return
	}
	if uploadID := q.Get("uploadId"); uploadID != "" {
		switch r.Method {
		case http.MethodPut:
			s.uploadPart(w, r, b, key, uploadID)
		case http.MethodPost:
			s.completeMultipart(w, r, b, key, uploadID)
		case http.MethodDelete:
			s.abortMultipart(w, r, uploadID)
		default:
			writeS3Error(w, http.StatusMethodNotAllowed, "MethodNotAllowed", "", key)
		}
		return
	}

	switch r.Method {
	case http.MethodPut:
		s.putObject(w, r, b, key)
	case http.MethodGet:
		s.getObject(w, r, b, key, true)
	case http.MethodHead:
		s.getObject(w, r, b, key, false)
	case http.MethodDelete:
		if err := s.DeleteObject(r.Context(), b, key); err != nil {
			writeS3Error(w, http.StatusInternalServerError, "InternalError", err.Error(), key)
			return
		}
		w.WriteHeader(http.StatusNoContent)
	default:
		writeS3Error(w, http.StatusMethodNotAllowed, "MethodNotAllowed", "", key)
	}
}

func (s *Server) putObject(w http.ResponseWriter, r *http.Request, b *store.Bucket, key string) {
	ct := r.Header.Get("Content-Type")
	if ct == "" {
		ct = "application/octet-stream"
	}
	etag, err := s.PutObject(r.Context(), b, key, ct, objectBody(r))
	if err != nil {
		writeS3Error(w, http.StatusInternalServerError, "InternalError", err.Error(), key)
		return
	}
	w.Header().Set("ETag", quote(etag))
	w.WriteHeader(http.StatusOK)
}

func (s *Server) getObject(w http.ResponseWriter, r *http.Request, b *store.Bucket, key string, withBody bool) {
	o, err := s.store.ObjectByKey(b.ID, key)
	if errors.Is(err, store.ErrNotFound) {
		writeS3Error(w, http.StatusNotFound, "NoSuchKey", "", key)
		return
	}
	if err != nil {
		writeS3Error(w, http.StatusInternalServerError, "InternalError", err.Error(), key)
		return
	}
	w.Header().Set("ETag", quote(o.ETag))
	w.Header().Set("Content-Type", o.ContentType)
	w.Header().Set("Last-Modified", o.UpdatedAt)
	w.Header().Set("Accept-Ranges", "bytes")

	if !withBody { // HEAD
		w.Header().Set("Content-Length", strconv.FormatInt(o.Size, 10))
		w.WriteHeader(http.StatusOK)
		return
	}

	if o.IsMultipart {
		s.serveMultipart(w, r, o)
		return
	}
	s.serveSingle(w, r, o)
}

func (s *Server) serveSingle(w http.ResponseWriter, r *http.Request, o *store.ObjectRow) {
	acc, err := s.store.DriveAccountByID(o.AccountID.String)
	if err != nil {
		writeS3Error(w, http.StatusInternalServerError, "InternalError", "backing account missing", o.Key)
		return
	}
	refresh, err := s.refreshFor(acc)
	if err != nil {
		writeS3Error(w, http.StatusInternalServerError, "InternalError", "token error", o.Key)
		return
	}
	resp, err := s.drive.Download(r.Context(), refresh, o.DriveFileID.String, r.Header.Get("Range"))
	if err != nil {
		writeS3Error(w, http.StatusBadGateway, "InternalError", err.Error(), o.Key)
		return
	}
	defer resp.Body.Close()
	if cl := resp.Header.Get("Content-Length"); cl != "" {
		w.Header().Set("Content-Length", cl)
	}
	if cr := resp.Header.Get("Content-Range"); cr != "" {
		w.Header().Set("Content-Range", cr)
	}
	w.WriteHeader(resp.StatusCode)
	_, _ = io.Copy(w, resp.Body)
}

func (s *Server) serveMultipart(w http.ResponseWriter, r *http.Request, o *store.ObjectRow) {
	parts := parsePartsManifest(o.Parts)
	start, end, isRange := parseRange(r.Header.Get("Range"), o.Size)
	reader, err := s.openMultipartRange(r.Context(), parts, start, end)
	if err != nil {
		writeS3Error(w, http.StatusBadGateway, "InternalError", err.Error(), o.Key)
		return
	}
	defer reader.Close()
	if isRange {
		w.Header().Set("Content-Length", strconv.FormatInt(end-start+1, 10))
		w.Header().Set("Content-Range", fmt.Sprintf("bytes %d-%d/%d", start, end, o.Size))
		w.WriteHeader(http.StatusPartialContent)
	} else {
		w.Header().Set("Content-Length", strconv.FormatInt(o.Size, 10))
		w.WriteHeader(http.StatusOK)
	}
	_, _ = io.Copy(w, reader)
}

func (s *Server) initiateMultipart(w http.ResponseWriter, r *http.Request, b *store.Bucket, key string) {
	ct := r.Header.Get("Content-Type")
	if ct == "" {
		ct = "application/octet-stream"
	}
	uploadID, err := s.InitiateMultipart(b, key, ct)
	if err != nil {
		writeS3Error(w, http.StatusInternalServerError, "InternalError", err.Error(), key)
		return
	}
	writeXML(w, http.StatusOK, initiateMultipartResult{Bucket: b.Name, Key: key, UploadID: uploadID})
}

func (s *Server) uploadPart(w http.ResponseWriter, r *http.Request, _ *store.Bucket, _, uploadID string) {
	mu, err := s.store.MultipartByID(uploadID)
	if err != nil {
		writeS3Error(w, http.StatusNotFound, "NoSuchUpload", "", uploadID)
		return
	}
	partNum, _ := strconv.Atoi(r.URL.Query().Get("partNumber"))
	if partNum < 1 {
		writeS3Error(w, http.StatusBadRequest, "InvalidArgument", "bad partNumber", uploadID)
		return
	}
	etag, err := s.UploadPart(r.Context(), mu, partNum, objectBody(r))
	if err != nil {
		writeS3Error(w, http.StatusInternalServerError, "InternalError", err.Error(), uploadID)
		return
	}
	w.Header().Set("ETag", quote(etag))
	w.WriteHeader(http.StatusOK)
}

func (s *Server) completeMultipart(w http.ResponseWriter, r *http.Request, b *store.Bucket, key, uploadID string) {
	mu, err := s.store.MultipartByID(uploadID)
	if err != nil {
		writeS3Error(w, http.StatusNotFound, "NoSuchUpload", "", uploadID)
		return
	}
	etag, _, err := s.CompleteMultipart(r.Context(), b, mu)
	if err != nil {
		writeS3Error(w, http.StatusInternalServerError, "InternalError", err.Error(), key)
		return
	}
	writeXML(w, http.StatusOK, completeMultipartResult{
		Location: "/" + b.Name + "/" + key, Bucket: b.Name, Key: key, ETag: quote(etag),
	})
}

func (s *Server) abortMultipart(w http.ResponseWriter, r *http.Request, uploadID string) {
	mu, err := s.store.MultipartByID(uploadID)
	if err != nil {
		w.WriteHeader(http.StatusNoContent)
		return
	}
	_ = s.AbortMultipart(r.Context(), mu)
	w.WriteHeader(http.StatusNoContent)
}

func validBucketName(name string) bool {
	if len(name) < 3 || len(name) > 63 {
		return false
	}
	for _, c := range name {
		if !((c >= 'a' && c <= 'z') || (c >= '0' && c <= '9') || c == '-' || c == '.') {
			return false
		}
	}
	return true
}

// parseRange parses "bytes=start-end". Returns (0, size-1, false) if absent.
func parseRange(header string, size int64) (start, end int64, ok bool) {
	if !strings.HasPrefix(header, "bytes=") {
		return 0, size - 1, false
	}
	spec := strings.TrimPrefix(header, "bytes=")
	lo, hi, _ := strings.Cut(spec, "-")
	if lo == "" { // suffix range: bytes=-N
		n, _ := strconv.ParseInt(hi, 10, 64)
		if n > size {
			n = size
		}
		return size - n, size - 1, true
	}
	start, _ = strconv.ParseInt(lo, 10, 64)
	if hi == "" {
		return start, size - 1, true
	}
	end, _ = strconv.ParseInt(hi, 10, 64)
	if end > size-1 {
		end = size - 1
	}
	return start, end, true
}
