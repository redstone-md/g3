// Package httpd wires the G3 HTTP server: the embedded static panel, the panel
// REST API, and (in later phases) the S3-compatible API.
package httpd

import (
	"log"
	"net/http"
	"time"

	"g3/internal/config"
	"g3/internal/crypto"
	"g3/internal/drive"
	"g3/internal/s3"
	"g3/internal/store"
)

// api carries shared dependencies for handlers.
type api struct {
	store  *store.Store
	cfg    config.Config
	cipher *crypto.Cipher
	drive  *drive.Manager
	engine *s3.Server
}

// New builds the configured HTTP server.
func New(cfg config.Config, st *store.Store, cipher *crypto.Cipher, driveMgr *drive.Manager, engine *s3.Server) (*http.Server, error) {
	static, err := newStaticHandler()
	if err != nil {
		return nil, err
	}

	a := &api{store: st, cfg: cfg, cipher: cipher, drive: driveMgr, engine: engine}
	mux := http.NewServeMux()

	// Panel API — auth + session.
	mux.HandleFunc("GET /api/health", a.health)
	mux.HandleFunc("POST /api/auth/login", a.login)
	mux.HandleFunc("POST /api/auth/logout", a.logout)
	mux.HandleFunc("GET /api/me", a.me)

	// Users.
	mux.HandleFunc("GET /api/users", a.listUsers)
	mux.HandleFunc("POST /api/users", a.createUser)
	mux.HandleFunc("PATCH /api/users/{id}", a.updateUser)
	mux.HandleFunc("DELETE /api/users/{id}", a.deleteUser)

	// Roles.
	mux.HandleFunc("GET /api/roles", a.listRoles)
	mux.HandleFunc("POST /api/roles", a.createRole)
	mux.HandleFunc("PATCH /api/roles/{id}", a.updateRole)
	mux.HandleFunc("DELETE /api/roles/{id}", a.deleteRole)

	// Audit.
	mux.HandleFunc("GET /api/audit", a.listAudit)

	// Google Drive storage accounts.
	mux.HandleFunc("GET /api/accounts", a.listAccounts)
	mux.HandleFunc("GET /api/accounts/connect", a.connectAccount)
	mux.HandleFunc("GET /api/accounts/callback", a.accountCallback)
	mux.HandleFunc("POST /api/accounts/{id}/refresh", a.refreshAccount)
	mux.HandleFunc("PATCH /api/accounts/{id}", a.updateAccount)
	mux.HandleFunc("DELETE /api/accounts/{id}", a.deleteDriveAccount)

	// S3 storage admin (buckets, access keys, balancing).
	mux.HandleFunc("GET /api/buckets", a.listBuckets)
	mux.HandleFunc("POST /api/buckets", a.createBucket)
	mux.HandleFunc("DELETE /api/buckets/{id}", a.deleteBucket)
	// File manager.
	mux.HandleFunc("GET /api/buckets/{id}/objects", a.listBucketObjects)
	mux.HandleFunc("GET /api/buckets/{id}/object", a.downloadObject)
	mux.HandleFunc("POST /api/buckets/{id}/object", a.uploadObject)
	mux.HandleFunc("DELETE /api/buckets/{id}/object", a.deleteObjectPanel)
	mux.HandleFunc("GET /api/buckets/{id}/policy", a.getBucketPolicy)
	mux.HandleFunc("PUT /api/buckets/{id}/policy", a.setBucketPolicy)
	// Multipart upload (parallel parts from the browser).
	mux.HandleFunc("POST /api/buckets/{id}/uploads", a.initiateUpload)
	mux.HandleFunc("PUT /api/buckets/{id}/uploads", a.uploadPart)
	mux.HandleFunc("POST /api/buckets/{id}/uploads/complete", a.completeUpload)
	mux.HandleFunc("DELETE /api/buckets/{id}/uploads", a.abortUpload)
	mux.HandleFunc("GET /api/keys", a.listKeys)
	mux.HandleFunc("POST /api/keys", a.createKey)
	mux.HandleFunc("DELETE /api/keys/{id}", a.deleteKey)
	mux.HandleFunc("GET /api/settings/balancing", a.getBalancing)
	mux.HandleFunc("PUT /api/settings/balancing", a.setBalancing)
	mux.HandleFunc("GET /api/stats", a.getStats)
	mux.HandleFunc("POST /api/storage/gc", a.collectGarbage)

	// Account (self-service).
	mux.HandleFunc("GET /api/account/sessions", a.listSessions)
	mux.HandleFunc("DELETE /api/account/sessions/{id}", a.revokeSession)
	mux.HandleFunc("DELETE /api/account/sessions", a.revokeOtherSessions)
	mux.HandleFunc("POST /api/account/password", a.changePassword)
	mux.HandleFunc("POST /api/account/email", a.changeEmail)
	mux.HandleFunc("PATCH /api/account/profile", a.updateProfile)
	mux.HandleFunc("PATCH /api/account/prefs", a.updatePrefs)
	mux.HandleFunc("DELETE /api/account", a.deleteAccount)
	mux.HandleFunc("GET /api/account/export", a.exportAccount)

	// Any other /api/* path is a JSON 404 (not the SPA fallback).
	mux.HandleFunc("/api/", a.apiNotFound)

	// Everything else: the embedded static SPA.
	mux.Handle("/", static)

	return &http.Server{
		Addr:              cfg.Addr,
		Handler:           LogRequests(mux),
		ReadHeaderTimeout: 10 * time.Second,
	}, nil
}

// LogRequests is a minimal access log, shared by the panel and the S3 API —
// without it an S3 client's failures (a proxy's 413, a rejected signature) are
// invisible on the server.
func LogRequests(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		rec := &statusRecorder{ResponseWriter: w, status: http.StatusOK}
		next.ServeHTTP(rec, r)
		log.Printf("%s %s %d %s", r.Method, r.URL.Path, rec.status,
			time.Since(start).Round(time.Millisecond))
	})
}

// statusRecorder remembers the status code the handler wrote.
type statusRecorder struct {
	http.ResponseWriter
	status int
}

func (s *statusRecorder) WriteHeader(code int) {
	s.status = code
	s.ResponseWriter.WriteHeader(code)
}
