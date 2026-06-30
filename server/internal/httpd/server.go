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

	// Panel API.
	mux.HandleFunc("GET /api/health", a.health)
	mux.HandleFunc("POST /api/auth/login", a.login)
	mux.HandleFunc("POST /api/auth/logout", a.logout)
	mux.HandleFunc("GET /api/me", a.me)
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
