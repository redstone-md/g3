package httpd

import (
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"net/http"
	"strings"
)

// --- buckets ---

type bucketDTO struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	CreatedAt   string `json:"createdAt"`
	ObjectCount int    `json:"objectCount"`
}

func (a *api) listBuckets(w http.ResponseWriter, r *http.Request) {
	if a.authorize(w, r, "storage.read") == nil {
		return
	}
	buckets, err := a.store.ListBuckets()
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not list buckets")
		return
	}
	out := make([]bucketDTO, 0, len(buckets))
	for _, b := range buckets {
		n, _ := a.store.BucketObjectCount(b.ID)
		out = append(out, bucketDTO{ID: b.ID, Name: b.Name, CreatedAt: b.CreatedAt, ObjectCount: n})
	}
	writeJSON(w, http.StatusOK, out)
}

func (a *api) createBucket(w http.ResponseWriter, r *http.Request) {
	actor := a.authorize(w, r, "storage.write")
	if actor == nil {
		return
	}
	var body struct {
		Name string `json:"name"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request")
		return
	}
	name := strings.ToLower(strings.TrimSpace(body.Name))
	if !validBucketDNS(name) {
		writeError(w, http.StatusBadRequest, "Bucket names are 3-63 chars: lowercase letters, digits, dot, hyphen.")
		return
	}
	if _, err := a.store.BucketByName(name); err == nil {
		writeError(w, http.StatusConflict, "A bucket with that name already exists.")
		return
	}
	id, err := a.store.CreateBucket(name)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not create bucket")
		return
	}
	a.store.LogAuditFull("bucket.create", actor.ID, actor.Email, "bucket", id, clientIP(r))
	writeJSON(w, http.StatusCreated, bucketDTO{ID: id, Name: name})
}

func (a *api) deleteBucket(w http.ResponseWriter, r *http.Request) {
	actor := a.authorize(w, r, "storage.write")
	if actor == nil {
		return
	}
	id := r.PathValue("id")
	if n, _ := a.store.BucketObjectCount(id); n > 0 {
		writeError(w, http.StatusConflict, "Bucket is not empty.")
		return
	}
	if err := a.store.DeleteBucket(id); err != nil {
		writeError(w, http.StatusInternalServerError, "could not delete bucket")
		return
	}
	a.store.LogAuditFull("bucket.delete", actor.ID, actor.Email, "bucket", id, clientIP(r))
	writeJSON(w, http.StatusOK, map[string]string{"id": id})
}

// --- access keys ---

type keyDTO struct {
	ID          string  `json:"id"`
	AccessKeyID string  `json:"accessKeyId"`
	Label       *string `json:"label"`
	CreatedAt   string  `json:"createdAt"`
	LastUsedAt  *string `json:"lastUsedAt"`
}

func (a *api) listKeys(w http.ResponseWriter, r *http.Request) {
	if a.authorize(w, r, "storage.read") == nil {
		return
	}
	keys, err := a.store.ListAccessKeys()
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not list keys")
		return
	}
	out := make([]keyDTO, 0, len(keys))
	for _, k := range keys {
		out = append(out, keyDTO{
			ID: k.ID, AccessKeyID: k.AccessKeyID, Label: nsPtr(k.Label),
			CreatedAt: k.CreatedAt, LastUsedAt: nsPtr(k.LastUsedAt),
		})
	}
	writeJSON(w, http.StatusOK, out)
}

func (a *api) createKey(w http.ResponseWriter, r *http.Request) {
	actor := a.authorize(w, r, "storage.write")
	if actor == nil {
		return
	}
	var body struct {
		Label string `json:"label"`
	}
	_ = json.NewDecoder(r.Body).Decode(&body)

	accessKeyID := "G3" + randomUpper(18)
	secret := randomSecret(40)
	enc, err := a.cipher.Encrypt(secret)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not secure secret")
		return
	}
	id, err := a.store.CreateAccessKey(accessKeyID, enc, strings.TrimSpace(body.Label))
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not create key")
		return
	}
	a.store.LogAuditFull("key.create", actor.ID, actor.Email, "access_key", id, clientIP(r))
	// The secret is returned exactly once.
	writeJSON(w, http.StatusCreated, map[string]string{
		"id": id, "accessKeyId": accessKeyID, "secretAccessKey": secret, "label": body.Label,
	})
}

func (a *api) deleteKey(w http.ResponseWriter, r *http.Request) {
	actor := a.authorize(w, r, "storage.write")
	if actor == nil {
		return
	}
	id := r.PathValue("id")
	if err := a.store.DeleteAccessKey(id); err != nil {
		writeError(w, http.StatusInternalServerError, "could not delete key")
		return
	}
	a.store.LogAuditFull("key.delete", actor.ID, actor.Email, "access_key", id, clientIP(r))
	writeJSON(w, http.StatusOK, map[string]string{"id": id})
}

// --- dashboard stats ---

func (a *api) getStats(w http.ResponseWriter, r *http.Request) {
	if a.authorize(w, r, "storage.read") == nil {
		return
	}
	st, err := a.store.Stats()
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not load stats")
		return
	}
	writeJSON(w, http.StatusOK, st)
}

// --- balancing strategy ---

var validStrategies = map[string]bool{
	"round_robin": true, "least_used": true, "fill_first": true, "hash": true,
}

func (a *api) getBalancing(w http.ResponseWriter, r *http.Request) {
	if a.authorize(w, r, "storage.read") == nil {
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{
		"strategy": a.store.GetSetting("balancing_strategy", "round_robin"),
	})
}

func (a *api) setBalancing(w http.ResponseWriter, r *http.Request) {
	actor := a.authorize(w, r, "storage.write")
	if actor == nil {
		return
	}
	var body struct {
		Strategy string `json:"strategy"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || !validStrategies[body.Strategy] {
		writeError(w, http.StatusBadRequest, "invalid strategy")
		return
	}
	if err := a.store.SetSetting("balancing_strategy", body.Strategy); err != nil {
		writeError(w, http.StatusInternalServerError, "could not save strategy")
		return
	}
	a.store.LogAuditFull("balancing.update", actor.ID, actor.Email, "setting", body.Strategy, clientIP(r))
	writeJSON(w, http.StatusOK, map[string]string{"strategy": body.Strategy})
}

// --- helpers ---

func validBucketDNS(name string) bool {
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

const upperAlnum = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"

func randomUpper(n int) string {
	b := make([]byte, n)
	_, _ = rand.Read(b)
	for i := range b {
		b[i] = upperAlnum[int(b[i])%len(upperAlnum)]
	}
	return string(b)
}

func randomSecret(n int) string {
	b := make([]byte, n)
	_, _ = rand.Read(b)
	return base64.RawURLEncoding.EncodeToString(b)[:n]
}

// collectGarbage reclaims Drive space that no object references any more.
// It reports what it found and only deletes when the caller passes
// ?apply=true, so the destructive half is never a side effect of looking.
func (a *api) collectGarbage(w http.ResponseWriter, r *http.Request) {
	actor := a.authorize(w, r, "storage.write")
	if actor == nil {
		return
	}
	apply := r.URL.Query().Get("apply") == "true"
	report, err := a.engine.CollectGarbage(r.Context(), apply)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if apply {
		a.store.LogAuditFull("storage.gc", actor.ID, actor.Email, "storage", "", clientIP(r))
	}
	writeJSON(w, http.StatusOK, report)
}
