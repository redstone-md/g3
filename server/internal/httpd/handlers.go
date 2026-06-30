package httpd

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"strings"
	"time"

	"g3/internal/auth"
	"g3/internal/store"
)

const sessionCookie = "ribbon_session"
const sessionTTL = 30 * 24 * time.Hour

// --- JSON helpers ---

func writeJSON(w http.ResponseWriter, status int, body any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(body)
}

func writeError(w http.ResponseWriter, status int, message string) {
	writeJSON(w, status, map[string]string{"error": message})
}

func (a *api) apiNotFound(w http.ResponseWriter, _ *http.Request) {
	writeError(w, http.StatusNotFound, "not found")
}

// --- session helpers ---

func clientIP(r *http.Request) string {
	if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
		return strings.TrimSpace(strings.Split(xff, ",")[0])
	}
	if rip := r.Header.Get("X-Real-IP"); rip != "" {
		return rip
	}
	return r.RemoteAddr
}

func (a *api) setSessionCookie(w http.ResponseWriter, token string) {
	http.SetCookie(w, &http.Cookie{
		Name:     sessionCookie,
		Value:    token,
		Path:     "/",
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
		Secure:   !a.cfg.DevMode,
		MaxAge:   int(sessionTTL.Seconds()),
	})
}

func (a *api) clearSessionCookie(w http.ResponseWriter) {
	http.SetCookie(w, &http.Cookie{
		Name:     sessionCookie,
		Value:    "",
		Path:     "/",
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
		Secure:   !a.cfg.DevMode,
		MaxAge:   -1,
	})
}

// requireUser resolves the signed-in user from the session cookie, or nil.
func (a *api) requireUser(r *http.Request) *store.User {
	c, err := r.Cookie(sessionCookie)
	if err != nil || c.Value == "" {
		return nil
	}
	u, err := a.store.UserBySessionToken(auth.HashToken(c.Value))
	if err != nil {
		return nil
	}
	return u
}

// --- handlers ---

func (a *api) health(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

type loginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type loginResponse struct {
	MustChangePassword bool   `json:"mustChangePassword"`
	Theme              string `json:"theme"`
	Motion             string `json:"motion"`
	Locale             string `json:"locale"`
}

func (a *api) login(w http.ResponseWriter, r *http.Request) {
	var req loginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request")
		return
	}
	email := strings.ToLower(strings.TrimSpace(req.Email))

	// Generic message — never reveal which field was wrong.
	const invalid = "Invalid email or password."

	user, err := a.store.UserByEmail(email)
	if err != nil || !auth.VerifyPassword(req.Password, user.PasswordHash) {
		writeError(w, http.StatusUnauthorized, invalid)
		return
	}

	token, hash := auth.NewSessionToken()
	if err := a.store.CreateSession(user.ID, hash, r.UserAgent(), clientIP(r),
		time.Now().Add(sessionTTL)); err != nil {
		writeError(w, http.StatusInternalServerError, "could not start session")
		return
	}
	a.setSessionCookie(w, token)
	a.store.LogAudit("auth.login", user.ID, user.Email)

	writeJSON(w, http.StatusOK, loginResponse{
		MustChangePassword: user.MustChangePassword,
		Theme:              user.Theme,
		Motion:             user.Motion,
		Locale:             user.Locale,
	})
}

func (a *api) logout(w http.ResponseWriter, r *http.Request) {
	if c, err := r.Cookie(sessionCookie); err == nil && c.Value != "" {
		_ = a.store.DeleteSession(auth.HashToken(c.Value))
	}
	a.clearSessionCookie(w)
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

type meResponse struct {
	ID                   string            `json:"id"`
	Email                string            `json:"email"`
	Name                 *string           `json:"name"`
	Avatar               *string           `json:"avatar"`
	Theme                string            `json:"theme"`
	Motion               string            `json:"motion"`
	Locale               string            `json:"locale"`
	NotificationsEnabled bool              `json:"notificationsEnabled"`
	MustChangePassword   bool              `json:"mustChangePassword"`
	Permissions          []string          `json:"permissions"`
	Roles                []meRole          `json:"roles"`
	IsLastAdmin          bool              `json:"isLastAdmin"`
}

type meRole struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

// nsPtr converts a nullable string column to a JSON-friendly *string.
func nsPtr(ns sql.NullString) *string {
	if !ns.Valid {
		return nil
	}
	v := ns.String
	return &v
}

func (a *api) me(w http.ResponseWriter, r *http.Request) {
	user := a.requireUser(r)
	if user == nil {
		writeError(w, http.StatusUnauthorized, "not authenticated")
		return
	}

	perms, err := a.store.EffectivePermissions(user.ID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not load permissions")
		return
	}
	roles, err := a.store.RolesForUser(user.ID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not load roles")
		return
	}
	lastAdmin, _ := a.store.IsLastAdmin(user.ID)

	roleDTOs := make([]meRole, 0, len(roles))
	for _, role := range roles {
		roleDTOs = append(roleDTOs, meRole{ID: role.ID, Name: role.Name})
	}

	writeJSON(w, http.StatusOK, meResponse{
		ID:                   user.ID,
		Email:                user.Email,
		Name:                 nsPtr(user.Name),
		Avatar:               nsPtr(user.Avatar),
		Theme:                user.Theme,
		Motion:               user.Motion,
		Locale:               user.Locale,
		NotificationsEnabled: user.NotificationsEnabled,
		MustChangePassword:   user.MustChangePassword,
		Permissions:          perms,
		Roles:                roleDTOs,
		IsLastAdmin:          lastAdmin,
	})
}
