// Command g3 is the single-binary G3 server: it serves the embedded static
// panel, the panel REST API, and (in later phases) an S3-compatible API backed
// by Google Drive.
package main

import (
	"context"
	"errors"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"g3/internal/config"
	"g3/internal/crypto"
	"g3/internal/drive"
	"g3/internal/httpd"
	"g3/internal/s3"
	"g3/internal/store"
)

func main() {
	cfg := config.Load()

	st, err := store.Open(cfg.DataDir, cfg.AdminEmail, cfg.AdminPassword)
	if err != nil {
		log.Fatalf("[g3] store: %v", err)
	}
	defer st.Close()

	key, err := crypto.LoadOrCreateKey(cfg.EncryptionKey, cfg.DataDir)
	if err != nil {
		log.Fatalf("[g3] encryption key: %v", err)
	}
	cipher, err := crypto.New(key)
	if err != nil {
		log.Fatalf("[g3] cipher: %v", err)
	}
	driveMgr := drive.New(cfg.GoogleClientID, cfg.GoogleClientSecret, cfg.GoogleRedirectURI)
	if !driveMgr.Configured() {
		log.Println("[g3] Google Drive not configured (set G3_GOOGLE_* to enable account linking)")
	}

	// One storage engine shared by the S3 API and the panel file manager.
	engine := s3.New(st, driveMgr, cipher)

	srv, err := httpd.New(cfg, st, cipher, driveMgr, engine)
	if err != nil {
		log.Fatalf("[g3] server: %v", err)
	}

	// S3-compatible API on its own listener (separate from the panel/SPA).
	s3srv := &http.Server{
		Addr:              cfg.S3Addr,
		Handler:           httpd.LogRequests(engine),
		ReadHeaderTimeout: 10 * time.Second,
	}

	// Clients that die mid-upload never abort their multipart uploads, so the
	// staged parts would sit on Drive forever. Sweeping them is safe enough to
	// run unattended; deleting unreferenced files is not, and stays manual.
	sweeper := time.NewTicker(time.Hour)
	defer sweeper.Stop()
	go func() {
		for range sweeper.C {
			if n, err := engine.SweepStaleUploads(context.Background(), 24*time.Hour); err != nil {
				log.Printf("[g3] sweep stale uploads: %v", err)
			} else if n > 0 {
				log.Printf("[g3] swept %d abandoned multipart upload(s)", n)
			}
		}
	}()

	go func() {
		log.Printf("[g3] panel listening on %s", cfg.Addr)
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Fatalf("[g3] listen: %v", err)
		}
	}()
	go func() {
		log.Printf("[g3] S3 API listening on %s", cfg.S3Addr)
		if err := s3srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Fatalf("[g3] s3 listen: %v", err)
		}
	}()

	// Graceful shutdown on SIGINT/SIGTERM.
	stop := make(chan os.Signal, 1)
	signal.Notify(stop, syscall.SIGINT, syscall.SIGTERM)
	<-stop
	log.Println("[g3] shutting down")

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	_ = srv.Shutdown(ctx)
	_ = s3srv.Shutdown(ctx)
}
