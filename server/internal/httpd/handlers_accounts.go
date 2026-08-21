package httpd

import (
	"context"
	"database/sql"
	"encoding/json"
	"net/http"
	"time"

	"g3/internal/auth"
	"g3/internal/store"
)

const oauthStateCookie = "g3_oauth_state"

// accountDTO is a linked account plus the bytes G3 itself stores on it. The
// Drive quota answers a different question — it counts the owner's unrelated
// files too — so the panel shows both numbers side by side.
type accountDTO struct {
	store.DriveAccount
	G3Usage int64 `json:"g3Usage"`
}

// quotaMaxAge is how stale a cached Drive quota may be before the listing
// re-reads it. Without a refresh the panel keeps showing whatever was true
// when the account was last touched, which after a burst of uploads and
// deletes can be off by a hundred gigabytes.
const quotaMaxAge = 15 * time.Minute

func (a *api) listAccounts(w http.ResponseWriter, r *http.Request) {
	if a.authorize(w, r, "accounts.read") == nil {
		return
	}
	accounts, err := a.store.ListDriveAccounts()
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not list accounts")
		return
	}
	usage, err := a.engine.UsageByAccount()
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not measure usage")
		return
	}
	out := make([]accountDTO, 0, len(accounts))
	for _, acc := range accounts {
		out = append(out, accountDTO{
			DriveAccount: a.freshQuota(r.Context(), acc),
			G3Usage:      usage[acc.ID],
		})
	}
	writeJSON(w, http.StatusOK, out)
}

// freshQuota re-reads an account's Drive quota when the cached one has aged
// out, returning the account either way: a Drive hiccup should not cost the
// panel its listing.
func (a *api) freshQuota(ctx context.Context, acc store.DriveAccount) store.DriveAccount {
	if acc.Status != "connected" || !olderThan(acc.LastSyncAt, quotaMaxAge) {
		return acc
	}
	full, err := a.store.DriveAccountByID(acc.ID)
	if err != nil {
		return acc
	}
	refresh, err := a.cipher.Decrypt(full.RefreshToken)
	if err != nil {
		return acc
	}
	ctx, cancel := context.WithTimeout(ctx, 15*time.Second)
	defer cancel()
	info, err := a.drive.RefreshInfo(ctx, refresh)
	if err != nil {
		return acc
	}
	_ = a.store.UpdateDriveQuota(acc.ID, info.Limit, info.Usage, "connected")
	acc.StorageLimit, acc.StorageUsage = info.Limit, info.Usage
	return acc
}

// olderThan reports whether a stored RFC3339 timestamp is missing, unreadable,
// or further in the past than max.
func olderThan(ts sql.NullString, max time.Duration) bool {
	if !ts.Valid {
		return true
	}
	t, err := time.Parse(time.RFC3339, ts.String)
	if err != nil {
		return true
	}
	return time.Since(t) > max
}

// connectAccount starts the Google OAuth consent flow (browser redirect).
func (a *api) connectAccount(w http.ResponseWriter, r *http.Request) {
	if a.authorize(w, r, "accounts.create") == nil {
		return
	}
	if !a.drive.Configured() {
		writeError(w, http.StatusServiceUnavailable,
			"Google Drive is not configured. Set G3_GOOGLE_CLIENT_ID/SECRET/REDIRECT_URI.")
		return
	}
	state := auth.NewID()
	http.SetCookie(w, &http.Cookie{
		Name:     oauthStateCookie,
		Value:    state,
		Path:     "/",
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
		Secure:   !a.cfg.DevMode,
		MaxAge:   600,
	})
	http.Redirect(w, r, a.drive.AuthURL(state), http.StatusFound)
}

// accountCallback completes the OAuth flow: exchange code, read identity/quota,
// persist the account, and bounce back to the panel.
func (a *api) accountCallback(w http.ResponseWriter, r *http.Request) {
	actor := a.authorize(w, r, "accounts.create")
	if actor == nil {
		return
	}
	q := r.URL.Query()
	if errMsg := q.Get("error"); errMsg != "" {
		http.Redirect(w, r, "/dashboard/accounts?error=denied", http.StatusFound)
		return
	}
	stateCookie, err := r.Cookie(oauthStateCookie)
	if err != nil || stateCookie.Value == "" || stateCookie.Value != q.Get("state") {
		http.Redirect(w, r, "/dashboard/accounts?error=state", http.StatusFound)
		return
	}
	a.clearStateCookie(w)

	ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
	defer cancel()

	tok, err := a.drive.Exchange(ctx, q.Get("code"))
	if err != nil || tok.RefreshToken == "" {
		http.Redirect(w, r, "/dashboard/accounts?error=exchange", http.StatusFound)
		return
	}
	info, err := a.drive.Probe(ctx, tok)
	if err != nil || info.Email == "" {
		http.Redirect(w, r, "/dashboard/accounts?error=probe", http.StatusFound)
		return
	}
	enc, err := a.cipher.Encrypt(tok.RefreshToken)
	if err != nil {
		http.Redirect(w, r, "/dashboard/accounts?error=encrypt", http.StatusFound)
		return
	}
	id, err := a.store.UpsertDriveAccount(info.Email, enc, info.FolderID, info.Limit, info.Usage)
	if err != nil {
		http.Redirect(w, r, "/dashboard/accounts?error=save", http.StatusFound)
		return
	}
	a.store.LogAuditFull("account.link", actor.ID, actor.Email, "drive_account", id, clientIP(r))
	http.Redirect(w, r, "/dashboard/accounts?connected=1", http.StatusFound)
}

// refreshAccount re-reads a linked account's live quota from Drive.
func (a *api) refreshAccount(w http.ResponseWriter, r *http.Request) {
	if a.authorize(w, r, "accounts.read") == nil {
		return
	}
	acc, err := a.store.DriveAccountByID(r.PathValue("id"))
	if err != nil {
		writeError(w, http.StatusNotFound, "account not found")
		return
	}
	refresh, err := a.cipher.Decrypt(acc.RefreshToken)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not read token")
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
	defer cancel()

	info, err := a.drive.RefreshInfo(ctx, refresh)
	if err != nil {
		_ = a.store.UpdateDriveQuota(acc.ID, acc.StorageLimit, acc.StorageUsage, "error")
		writeError(w, http.StatusBadGateway, "could not reach Google Drive")
		return
	}
	if err := a.store.UpdateDriveQuota(acc.ID, info.Limit, info.Usage, "connected"); err != nil {
		writeError(w, http.StatusInternalServerError, "could not update quota")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"id": acc.ID, "storageLimit": info.Limit, "storageUsage": info.Usage, "status": "connected",
	})
}

type updateAccountBody struct {
	Weight *int `json:"weight"`
}

func (a *api) updateAccount(w http.ResponseWriter, r *http.Request) {
	if a.authorize(w, r, "accounts.create") == nil {
		return
	}
	var body updateAccountBody
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request")
		return
	}
	if body.Weight != nil {
		weight := *body.Weight
		if weight < 0 {
			weight = 0
		}
		if err := a.store.SetDriveAccountWeight(r.PathValue("id"), weight); err != nil {
			writeError(w, http.StatusInternalServerError, "could not update account")
			return
		}
	}
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

func (a *api) deleteDriveAccount(w http.ResponseWriter, r *http.Request) {
	actor := a.authorize(w, r, "accounts.delete")
	if actor == nil {
		return
	}
	id := r.PathValue("id")
	if err := a.store.DeleteDriveAccount(id); err != nil {
		writeError(w, http.StatusInternalServerError, "could not remove account")
		return
	}
	a.store.LogAuditFull("account.unlink", actor.ID, actor.Email, "drive_account", id, clientIP(r))
	writeJSON(w, http.StatusOK, map[string]string{"id": id})
}

func (a *api) clearStateCookie(w http.ResponseWriter) {
	http.SetCookie(w, &http.Cookie{
		Name: oauthStateCookie, Value: "", Path: "/", HttpOnly: true,
		SameSite: http.SameSiteLaxMode, Secure: !a.cfg.DevMode, MaxAge: -1,
	})
}
