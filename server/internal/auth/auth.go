// Package auth provides password hashing, session-token helpers, ID generation,
// and the authoritative permission catalog for the G3 panel.
package auth

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"

	"golang.org/x/crypto/bcrypt"
)

// bcryptCost balances login latency against resistance to offline cracking.
const bcryptCost = 12

// HashPassword returns a bcrypt hash of the plaintext password.
func HashPassword(plain string) (string, error) {
	b, err := bcrypt.GenerateFromPassword([]byte(plain), bcryptCost)
	return string(b), err
}

// VerifyPassword reports whether plain matches the stored bcrypt hash.
func VerifyPassword(plain, hash string) bool {
	return bcrypt.CompareHashAndPassword([]byte(hash), []byte(plain)) == nil
}

// NewID returns a random 24-hex-char identifier.
func NewID() string {
	b := make([]byte, 12)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}

// NewSessionToken returns an opaque token (for the cookie) and its SHA-256 hash
// (for storage). The plaintext token is never persisted.
func NewSessionToken() (token, hash string) {
	b := make([]byte, 32)
	_, _ = rand.Read(b)
	token = base64.RawURLEncoding.EncodeToString(b)
	return token, HashToken(token)
}

// HashToken returns the hex SHA-256 of a session token.
func HashToken(token string) string {
	sum := sha256.Sum256([]byte(token))
	return hex.EncodeToString(sum[:])
}

// AllPermissions is the authoritative permission catalog. It mirrors
// src/lib/permissions.ts on the frontend (oauth group removed for G3).
var AllPermissions = []string{
	"styleguide.view",
	"users.read", "users.create", "users.update", "users.delete",
	"roles.read", "roles.create", "roles.update", "roles.delete",
	"audit.read",
	"accounts.read", "accounts.create", "accounts.delete",
	"storage.read", "storage.write",
}

// AdminGrant is the permission whose presence marks a role as administrative
// (used to protect the last-admin invariant).
const AdminGrant = "roles.update"
