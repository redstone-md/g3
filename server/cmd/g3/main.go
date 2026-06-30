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
	"g3/internal/httpd"
	"g3/internal/store"
)

func main() {
	cfg := config.Load()

	st, err := store.Open(cfg.DataDir, cfg.AdminEmail, cfg.AdminPassword)
	if err != nil {
		log.Fatalf("[g3] store: %v", err)
	}
	defer st.Close()

	srv, err := httpd.New(cfg, st)
	if err != nil {
		log.Fatalf("[g3] server: %v", err)
	}

	go func() {
		log.Printf("[g3] listening on %s", cfg.Addr)
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Fatalf("[g3] listen: %v", err)
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
}
