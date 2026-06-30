// Package httpd wires the G3 HTTP server: the embedded static panel, the panel
// REST API, and (in later phases) the S3-compatible API.
package httpd

import (
	"log"
	"net/http"
	"time"

	"g3/internal/config"
	"g3/internal/store"
)

// api carries shared dependencies for handlers.
type api struct {
	store *store.Store
	cfg   config.Config
}

// New builds the configured HTTP server.
func New(cfg config.Config, st *store.Store) (*http.Server, error) {
	static, err := newStaticHandler()
	if err != nil {
		return nil, err
	}

	a := &api{store: st, cfg: cfg}
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
		Handler:           logRequests(mux),
		ReadHeaderTimeout: 10 * time.Second,
	}, nil
}

// logRequests is a minimal access log.
func logRequests(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		next.ServeHTTP(w, r)
		log.Printf("%s %s %s", r.Method, r.URL.Path, time.Since(start).Round(time.Millisecond))
	})
}
