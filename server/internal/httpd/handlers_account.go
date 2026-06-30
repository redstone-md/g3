package httpd

import (
	"encoding/json"
	"net/http"
	"strings"

	"g3/internal/auth"
)

// --- sessions ---

type sessionDTO struct {
	ID        string  `json:"id"`
	UserAgent *string `json:"userAgent"`
	IP        *string `json:"ip"`
	CreatedAt string  `json:"createdAt"`
	Current   bool    `json:"current"`
}

func (a *api) listSessions(w http.ResponseWriter, r *http.Request) {
	user := a.requireUser(r)
	if user == nil {
		writeError(w, http.StatusUnauthorized, "not authenticated")
		return
	}
	rows, err := a.store.ListSessions(user.ID, a.currentTokenHash(r))
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not load sessions")
		return
	}
	dtos := make([]sessionDTO, 0, len(rows))
	for _, s := range rows {
		dtos = append(dtos, sessionDTO{
			ID: s.ID, UserAgent: nsPtr(s.UserAgent), IP: nsPtr(s.IP),
			CreatedAt: s.CreatedAt, Current: s.Current,
		})
	}
	writeJSON(w, http.StatusOK, dtos)
}

func (a *api) revokeSession(w http.ResponseWriter, r *http.Request) {
	user := a.requireUser(r)
	if user == nil {
		writeError(w, http.StatusUnauthorized, "not authenticated")
		return
	}
	if err := a.store.DeleteSessionForUser(user.ID, r.PathValue("id")); err != nil {
		writeError(w, http.StatusInternalServerError, "could not revoke session")
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

func (a *api) revokeOtherSessions(w http.ResponseWriter, r *http.Request) {
	user := a.requireUser(r)
	if user == nil {
		writeError(w, http.StatusUnauthorized, "not authenticated")
		return
	}
	if err := a.store.DeleteOtherSessions(user.ID, a.currentTokenHash(r)); err != nil {
		writeError(w, http.StatusInternalServerError, "could not revoke sessions")
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

// --- password / email ---

type changePasswordBody struct {
	Current string `json:"current"`
	Next    string `json:"next"`
	Confirm string `json:"confirm"`
}

func (a *api) changePassword(w http.ResponseWriter, r *http.Request) {
	user := a.requireUser(r)
	if user == nil {
		writeError(w, http.StatusUnauthorized, "not authenticated")
		return
	}
	var body changePasswordBody
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request")
		return
	}
	if !auth.VerifyPassword(body.Current, user.PasswordHash) {
		writeError(w, http.StatusBadRequest, "Current password is incorrect.")
		return
	}
	if body.Next != body.Confirm {
		writeError(w, http.StatusBadRequest, "Passwords do not match.")
		return
	}
	if !validPassword(body.Next) {
		writeError(w, http.StatusBadRequest, "Password must be 8+ chars with a letter and a number.")
		return
	}
	hash, err := auth.HashPassword(body.Next)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not hash password")
		return
	}
	if err := a.store.SetPassword(user.ID, hash); err != nil {
		writeError(w, http.StatusInternalServerError, "could not update password")
		return
	}
	a.store.LogAuditFull("auth.password_change", user.ID, user.Email, "", "", clientIP(r))
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

type changeEmailBody struct {
	Email           string `json:"email"`
	CurrentPassword string `json:"currentPassword"`
}

func (a *api) changeEmail(w http.ResponseWriter, r *http.Request) {
	user := a.requireUser(r)
	if user == nil {
		writeError(w, http.StatusUnauthorized, "not authenticated")
		return
	}
	var body changeEmailBody
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request")
		return
	}
	if !auth.VerifyPassword(body.CurrentPassword, user.PasswordHash) {
		writeError(w, http.StatusBadRequest, "Current password is incorrect.")
		return
	}
	email := strings.ToLower(strings.TrimSpace(body.Email))
	if !validEmail(email) {
		writeError(w, http.StatusBadRequest, "Enter a valid email.")
		return
	}
	if taken, _ := a.store.EmailExists(email, user.ID); taken {
		writeError(w, http.StatusConflict, "That email is already in use.")
		return
	}
	if err := a.store.SetEmail(user.ID, email); err != nil {
		writeError(w, http.StatusInternalServerError, "could not change email")
		return
	}
	a.store.LogAuditFull("user.email_change", user.ID, email, "user", user.ID, clientIP(r))
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

// --- profile / prefs ---

type profileBody struct {
	Name   string  `json:"name"`
	Avatar *string `json:"avatar"`
}

func (a *api) updateProfile(w http.ResponseWriter, r *http.Request) {
	user := a.requireUser(r)
	if user == nil {
		writeError(w, http.StatusUnauthorized, "not authenticated")
		return
	}
	var body profileBody
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request")
		return
	}
	name := strings.TrimSpace(body.Name)
	if len(name) > 80 {
		writeError(w, http.StatusBadRequest, "Name is too long.")
		return
	}
	if err := a.store.SetProfile(user.ID, &name, body.Avatar); err != nil {
		writeError(w, http.StatusInternalServerError, "could not update profile")
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

type prefsBody struct {
	Theme                *string `json:"theme"`
	Motion               *string `json:"motion"`
	Locale               *string `json:"locale"`
	NotificationsEnabled *bool   `json:"notificationsEnabled"`
}

func (a *api) updatePrefs(w http.ResponseWriter, r *http.Request) {
	user := a.requireUser(r)
	if user == nil {
		writeError(w, http.StatusUnauthorized, "not authenticated")
		return
	}
	var body prefsBody
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request")
		return
	}
	if err := a.store.SetPrefs(user.ID, body.Theme, body.Motion, body.Locale, body.NotificationsEnabled); err != nil {
		writeError(w, http.StatusInternalServerError, "could not update preferences")
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

// --- delete + export ---

type deleteAccountBody struct {
	CurrentPassword string `json:"currentPassword"`
}

func (a *api) deleteAccount(w http.ResponseWriter, r *http.Request) {
	user := a.requireUser(r)
	if user == nil {
		writeError(w, http.StatusUnauthorized, "not authenticated")
		return
	}
	var body deleteAccountBody
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request")
		return
	}
	if !auth.VerifyPassword(body.CurrentPassword, user.PasswordHash) {
		writeError(w, http.StatusBadRequest, "Current password is incorrect.")
		return
	}
	if last, _ := a.store.IsLastAdmin(user.ID); last {
		writeError(w, http.StatusConflict, "Cannot delete the last administrator.")
		return
	}
	if err := a.store.DeleteUser(user.ID); err != nil {
		writeError(w, http.StatusInternalServerError, "could not delete account")
		return
	}
	a.store.LogAuditFull("user.self_delete", user.ID, user.Email, "user", user.ID, clientIP(r))
	a.clearSessionCookie(w)
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

func (a *api) exportAccount(w http.ResponseWriter, r *http.Request) {
	user := a.requireUser(r)
	if user == nil {
		writeError(w, http.StatusUnauthorized, "not authenticated")
		return
	}
	data, err := a.store.ExportUser(user.ID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not export data")
		return
	}
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.Header().Set("Content-Disposition", `attachment; filename="g3-account-export.json"`)
	enc := json.NewEncoder(w)
	enc.SetIndent("", "  ")
	_ = enc.Encode(data)
}
