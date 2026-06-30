// Package config loads G3 server configuration from the environment, with an
// optional .env file (so the single binary needs no flags to run).
package config

import (
	"bufio"
	"os"
	"strings"
)

// Config holds all runtime settings for the G3 server.
type Config struct {
	Addr     string // panel + SPA listen address, e.g. ":8787"
	S3Addr   string // S3-compatible API listen address, e.g. ":9000"
	DataDir  string // directory for the SQLite metadata DB
	DevMode  bool   // relaxes cookie Secure flag for plain-HTTP local use

	AdminEmail    string // first-run seed admin email
	AdminPassword string // first-run seed admin password

	EncryptionKey string // base64 32-byte key for encrypting Drive tokens (Phase 3)

	GoogleClientID     string // Drive OAuth (Phase 3)
	GoogleClientSecret string
	GoogleRedirectURI  string
}

// Load reads .env (if present) then the process environment, env taking
// precedence. Unset values fall back to sensible defaults.
func Load() Config {
	loadDotEnv(".env")

	return Config{
		Addr:               getenv("G3_ADDR", ":8787"),
		S3Addr:             getenv("G3_S3_ADDR", ":9000"),
		DataDir:            getenv("G3_DATA_DIR", "./g3-data"),
		DevMode:            getenv("G3_DEV", "true") != "false",
		AdminEmail:         getenv("G3_ADMIN_EMAIL", "admin@g3.local"),
		AdminPassword:      getenv("G3_ADMIN_PASSWORD", "change-me-now"),
		EncryptionKey:      getenv("G3_ENCRYPTION_KEY", ""),
		GoogleClientID:     getenv("G3_GOOGLE_CLIENT_ID", ""),
		GoogleClientSecret: getenv("G3_GOOGLE_CLIENT_SECRET", ""),
		GoogleRedirectURI:  getenv("G3_GOOGLE_REDIRECT_URI", ""),
	}
}

func getenv(key, fallback string) string {
	if v, ok := os.LookupEnv(key); ok {
		return v
	}
	return fallback
}

// loadDotEnv parses a simple KEY=VALUE file into the environment without
// overriding values already set in the process environment.
func loadDotEnv(path string) {
	f, err := os.Open(path)
	if err != nil {
		return
	}
	defer f.Close()

	scanner := bufio.NewScanner(f)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		key, value, found := strings.Cut(line, "=")
		if !found {
			continue
		}
		key = strings.TrimSpace(key)
		value = strings.Trim(strings.TrimSpace(value), `"'`)
		if _, exists := os.LookupEnv(key); !exists {
			_ = os.Setenv(key, value)
		}
	}
}
