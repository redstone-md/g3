package s3

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"time"

	"g3/internal/store"
)

// parseCopySource splits an x-amz-copy-source value ("/bucket/key",
// "bucket/key", optionally URL-encoded and with a ?versionId suffix) into its
// bucket and key.
func parseCopySource(v string) (bucket, key string, err error) {
	if i := strings.IndexByte(v, '?'); i >= 0 {
		v = v[:i] // versioning is not supported; the id is ignored
	}
	if decoded, derr := url.PathUnescape(v); derr == nil {
		v = decoded
	}
	v = strings.TrimPrefix(v, "/")
	bucket, key = splitPath("/" + v)
	if bucket == "" || key == "" {
		return "", "", errors.New("malformed x-amz-copy-source")
	}
	return bucket, key, nil
}

// copyObject implements PUT with x-amz-copy-source. Copying an object onto
// itself only rewrites metadata — that is how clients set a stored file's
// modification time (rclone's SetModTime) without re-sending its bytes.
// A copy to a different key duplicates the backing files inside their own
// Drive account, server-side, so no bytes travel through G3 either.
func (s *Server) copyObject(w http.ResponseWriter, r *http.Request, dst *store.Bucket, key, source string) {
	srcBucketName, srcKey, err := parseCopySource(source)
	if err != nil {
		writeS3Error(w, http.StatusBadRequest, "InvalidArgument", err.Error(), key)
		return
	}
	srcBucket, err := s.store.BucketByName(srcBucketName)
	if err != nil {
		writeS3Error(w, http.StatusNotFound, "NoSuchBucket", "", srcBucketName)
		return
	}
	src, err := s.store.ObjectByKey(srcBucket.ID, srcKey)
	if errors.Is(err, store.ErrNotFound) {
		writeS3Error(w, http.StatusNotFound, "NoSuchKey", "", srcKey)
		return
	}
	if err != nil {
		writeS3Error(w, http.StatusInternalServerError, "InternalError", err.Error(), key)
		return
	}

	replace := strings.EqualFold(r.Header.Get("X-Amz-Metadata-Directive"), "REPLACE")
	if srcBucket.ID == dst.ID && srcKey == key {
		s.rewriteMetadata(w, r, dst, src, replace)
		return
	}

	manifest, err := s.duplicateBacking(r.Context(), src, key)
	if err != nil {
		writeS3Error(w, http.StatusInternalServerError, "InternalError", err.Error(), key)
		return
	}

	row := store.ObjectWrite{
		BucketID: dst.ID, Key: key, Size: src.Size, ETag: src.ETag,
		ContentType: copiedContentType(r, src, replace),
		Metadata:    copiedMetadata(r, src, replace),
	}
	if len(manifest) == 1 && !src.IsMultipart {
		row.AccountID, row.DriveFileID = manifest[0].AccountID, manifest[0].DriveFileID
	} else {
		row.PartsJSON = marshalManifest(manifest)
	}
	prior, _ := s.store.ObjectByKey(dst.ID, key)
	if err := s.store.PutObject(row); err != nil {
		s.deleteManifest(r.Context(), manifest) // don't strand the fresh copies
		writeS3Error(w, http.StatusInternalServerError, "InternalError", err.Error(), key)
		return
	}
	if prior != nil {
		s.deleteBackingFiles(r.Context(), prior)
	}
	writeCopyResult(w, src.ETag)
}

// rewriteMetadata handles the copy-onto-itself case: the bytes stay where they
// are and only the object's content type and user metadata are updated.
func (s *Server) rewriteMetadata(w http.ResponseWriter, r *http.Request, b *store.Bucket, src *store.ObjectRow, replace bool) {
	err := s.store.UpdateObjectMeta(b.ID, src.Key,
		copiedContentType(r, src, replace), copiedMetadata(r, src, replace))
	if err != nil {
		writeS3Error(w, http.StatusInternalServerError, "InternalError", err.Error(), src.Key)
		return
	}
	writeCopyResult(w, src.ETag)
}

// duplicateBacking copies an object's Drive file(s) within their own accounts.
// Anything already copied is removed if a later copy fails, so a half-done
// duplication never leaves files behind.
func (s *Server) duplicateBacking(ctx context.Context, src *store.ObjectRow, dstKey string) ([]manifestPart, error) {
	parts := backingParts(src)
	if len(parts) == 0 {
		return nil, errors.New("source object has no backing files")
	}
	copied := make([]manifestPart, 0, len(parts))
	for i, p := range parts {
		acc, err := s.store.DriveAccountByID(p.AccountID)
		if err != nil {
			s.deleteManifest(ctx, copied)
			return nil, err
		}
		refresh, err := s.refreshFor(acc)
		if err != nil {
			s.deleteManifest(ctx, copied)
			return nil, err
		}
		folderID := ""
		if acc.FolderID.Valid {
			folderID = acc.FolderID.String
		}
		fileID, err := s.drive.Copy(ctx, refresh, p.DriveFileID,
			fmt.Sprintf("%s.part%d", dstKey, i), folderID)
		if err != nil {
			s.deleteManifest(ctx, copied)
			return nil, err
		}
		copied = append(copied, manifestPart{
			AccountID: p.AccountID, DriveFileID: fileID, Size: p.Size, ETag: p.ETag,
		})
	}
	return copied, nil
}

// backingParts describes an object's Drive files uniformly, whether it is
// stored as one file or as a manifest of parts.
func backingParts(o *store.ObjectRow) []manifestPart {
	if o.IsMultipart {
		return parsePartsManifest(o.Parts)
	}
	if !o.AccountID.Valid || !o.DriveFileID.Valid {
		return nil
	}
	return []manifestPart{{
		AccountID: o.AccountID.String, DriveFileID: o.DriveFileID.String,
		Size: o.Size, ETag: o.ETag,
	}}
}

// copiedContentType and copiedMetadata apply the metadata directive: REPLACE
// takes the values from the copy request, COPY (the default) keeps the
// source's.
func copiedContentType(r *http.Request, src *store.ObjectRow, replace bool) string {
	if ct := r.Header.Get("Content-Type"); replace && ct != "" {
		return ct
	}
	return src.ContentType
}

func copiedMetadata(r *http.Request, src *store.ObjectRow, replace bool) string {
	if replace {
		return userMetadataJSON(r.Header)
	}
	if src.Metadata.Valid {
		return src.Metadata.String
	}
	return ""
}

func writeCopyResult(w http.ResponseWriter, etag string) {
	writeXML(w, http.StatusOK, copyObjectResult{
		LastModified: time.Now().UTC().Format(time.RFC3339),
		ETag:         quote(etag),
	})
}
