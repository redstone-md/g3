package httpd

import (
	"encoding/json"
	"net/http"
	"path"
	"strconv"
	"strings"

	"g3/internal/store"
)

// objectEntry is one file in the panel file manager.
type objectEntry struct {
	Key         string `json:"key"`
	Name        string `json:"name"`
	Size        int64  `json:"size"`
	ETag        string `json:"etag"`
	ContentType string `json:"contentType"`
	UpdatedAt   string `json:"updatedAt"`
	IsMultipart bool   `json:"isMultipart"`
}

// objectListing groups objects under a prefix into folders + files (delimiter "/").
type objectListing struct {
	Bucket    string        `json:"bucket"`
	Prefix    string        `json:"prefix"`
	Folders   []string      `json:"folders"`
	Files     []objectEntry `json:"files"`
	Truncated bool          `json:"truncated"`
}

const objectListCap = 1000

func (a *api) bucketFromPath(w http.ResponseWriter, r *http.Request) *store.Bucket {
	b, err := a.store.BucketByID(r.PathValue("id"))
	if err != nil {
		writeError(w, http.StatusNotFound, "bucket not found")
		return nil
	}
	return b
}

// listBucketObjects returns folders + files under a prefix (file-manager view).
func (a *api) listBucketObjects(w http.ResponseWriter, r *http.Request) {
	if a.authorize(w, r, "storage.read") == nil {
		return
	}
	b := a.bucketFromPath(w, r)
	if b == nil {
		return
	}
	prefix := r.URL.Query().Get("prefix")

	rows, err := a.store.ListObjects(b.ID, prefix, "", objectListCap+1)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not list objects")
		return
	}
	out := objectListing{Bucket: b.Name, Prefix: prefix, Folders: []string{}, Files: []objectEntry{}}
	out.Truncated = len(rows) > objectListCap
	if out.Truncated {
		rows = rows[:objectListCap]
	}

	seenFolder := map[string]bool{}
	for _, o := range rows {
		rest := strings.TrimPrefix(o.Key, prefix)
		if i := strings.IndexByte(rest, '/'); i >= 0 {
			folder := prefix + rest[:i+1] // e.g. "photos/"
			if !seenFolder[folder] {
				seenFolder[folder] = true
				out.Folders = append(out.Folders, folder)
			}
			continue
		}
		out.Files = append(out.Files, objectEntry{
			Key: o.Key, Name: rest, Size: o.Size, ETag: o.ETag,
			ContentType: o.ContentType, UpdatedAt: o.UpdatedAt, IsMultipart: o.IsMultipart,
		})
	}
	writeJSON(w, http.StatusOK, out)
}

// downloadObject streams an object to the browser (panel download/preview).
func (a *api) downloadObject(w http.ResponseWriter, r *http.Request) {
	if a.authorize(w, r, "storage.read") == nil {
		return
	}
	b := a.bucketFromPath(w, r)
	if b == nil {
		return
	}
	key := r.URL.Query().Get("key")
	if key == "" {
		writeError(w, http.StatusBadRequest, "missing key")
		return
	}
	w.Header().Set("Content-Disposition", `attachment; filename="`+path.Base(key)+`"`)
	a.engine.ServeObject(w, r, b, key)
}

// uploadObject stores a file streamed in the request body under ?key=.
func (a *api) uploadObject(w http.ResponseWriter, r *http.Request) {
	actor := a.authorize(w, r, "storage.write")
	if actor == nil {
		return
	}
	b := a.bucketFromPath(w, r)
	if b == nil {
		return
	}
	key := r.URL.Query().Get("key")
	if key == "" {
		writeError(w, http.StatusBadRequest, "missing key")
		return
	}
	ct := r.Header.Get("Content-Type")
	if ct == "" || strings.HasPrefix(ct, "multipart/form-data") {
		ct = "application/octet-stream"
	}
	etag, err := a.engine.PutObject(r.Context(), b, key, ct, r.Body)
	if err != nil {
		writeError(w, http.StatusBadGateway, err.Error())
		return
	}
	a.store.LogAuditFull("object.upload", actor.ID, actor.Email, "object", b.Name+"/"+key, clientIP(r))
	writeJSON(w, http.StatusOK, map[string]string{"etag": etag, "key": key})
}

// deleteObjectPanel removes an object and its Drive backing file(s).
func (a *api) deleteObjectPanel(w http.ResponseWriter, r *http.Request) {
	actor := a.authorize(w, r, "storage.write")
	if actor == nil {
		return
	}
	b := a.bucketFromPath(w, r)
	if b == nil {
		return
	}
	key := r.URL.Query().Get("key")
	if key == "" {
		writeError(w, http.StatusBadRequest, "missing key")
		return
	}
	if err := a.engine.DeleteObject(r.Context(), b, key); err != nil {
		writeError(w, http.StatusInternalServerError, "could not delete object")
		return
	}
	a.store.LogAuditFull("object.delete", actor.ID, actor.Email, "object", b.Name+"/"+key, clientIP(r))
	writeJSON(w, http.StatusOK, map[string]string{"key": key})
}

// --- multipart upload (panel; browser slices the file and uploads parts in
// parallel, so each request is small enough for any proxy and shows progress) ---

func (a *api) initiateUpload(w http.ResponseWriter, r *http.Request) {
	if a.authorize(w, r, "storage.write") == nil {
		return
	}
	b := a.bucketFromPath(w, r)
	if b == nil {
		return
	}
	key := r.URL.Query().Get("key")
	if key == "" {
		writeError(w, http.StatusBadRequest, "missing key")
		return
	}
	ct := r.URL.Query().Get("contentType")
	if ct == "" {
		ct = "application/octet-stream"
	}
	uploadID, err := a.engine.InitiateMultipart(b, key, ct)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not start upload")
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"uploadId": uploadID})
}

func (a *api) uploadPart(w http.ResponseWriter, r *http.Request) {
	if a.authorize(w, r, "storage.write") == nil {
		return
	}
	mu, err := a.store.MultipartByID(r.URL.Query().Get("uploadId"))
	if err != nil {
		writeError(w, http.StatusNotFound, "upload not found")
		return
	}
	part, _ := strconv.Atoi(r.URL.Query().Get("partNumber"))
	if part < 1 {
		writeError(w, http.StatusBadRequest, "bad partNumber")
		return
	}
	etag, err := a.engine.UploadPart(r.Context(), mu, part, r.Body)
	if err != nil {
		writeError(w, http.StatusBadGateway, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"partNumber": part, "etag": etag})
}

func (a *api) completeUpload(w http.ResponseWriter, r *http.Request) {
	actor := a.authorize(w, r, "storage.write")
	if actor == nil {
		return
	}
	b := a.bucketFromPath(w, r)
	if b == nil {
		return
	}
	mu, err := a.store.MultipartByID(r.URL.Query().Get("uploadId"))
	if err != nil {
		writeError(w, http.StatusNotFound, "upload not found")
		return
	}
	etag, _, err := a.engine.CompleteMultipart(r.Context(), b, mu)
	if err != nil {
		writeError(w, http.StatusBadGateway, err.Error())
		return
	}
	a.store.LogAuditFull("object.upload", actor.ID, actor.Email, "object", b.Name+"/"+mu.Key, clientIP(r))
	writeJSON(w, http.StatusOK, map[string]string{"etag": etag, "key": mu.Key})
}

func (a *api) abortUpload(w http.ResponseWriter, r *http.Request) {
	if a.authorize(w, r, "storage.write") == nil {
		return
	}
	mu, err := a.store.MultipartByID(r.URL.Query().Get("uploadId"))
	if err == nil {
		_ = a.engine.AbortMultipart(r.Context(), mu)
	}
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

// --- bucket policy (panel) ---

func (a *api) getBucketPolicy(w http.ResponseWriter, r *http.Request) {
	if a.authorize(w, r, "storage.read") == nil {
		return
	}
	b := a.bucketFromPath(w, r)
	if b == nil {
		return
	}
	policy, _ := a.store.BucketPolicy(b.ID)
	writeJSON(w, http.StatusOK, map[string]string{"policy": policy})
}

func (a *api) setBucketPolicy(w http.ResponseWriter, r *http.Request) {
	actor := a.authorize(w, r, "storage.write")
	if actor == nil {
		return
	}
	b := a.bucketFromPath(w, r)
	if b == nil {
		return
	}
	var body struct {
		Policy string `json:"policy"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request")
		return
	}
	policy := strings.TrimSpace(body.Policy)
	if policy == "" {
		_ = a.store.DeleteBucketPolicy(b.ID)
	} else {
		if !json.Valid([]byte(policy)) {
			writeError(w, http.StatusBadRequest, "Policy must be valid JSON.")
			return
		}
		_ = a.store.SetBucketPolicy(b.ID, policy)
	}
	a.store.LogAuditFull("policy.update", actor.ID, actor.Email, "bucket", b.Name, clientIP(r))
	writeJSON(w, http.StatusOK, map[string]string{"policy": policy})
}
