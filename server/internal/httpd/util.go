package httpd

import (
	"net/http"
	"regexp"
	"strconv"
	"strings"

	"g3/internal/auth"
	"g3/internal/store"
)

// listParams holds parsed pagination/search/sort for list endpoints.
type listParams struct {
	q        string
	page     int
	pageSize int
	sort     string
	order    string
	offset   int
}

func parseList(r *http.Request, defaultSort string) listParams {
	sp := r.URL.Query()
	page := atoiDefault(sp.Get("page"), 1)
	if page < 1 {
		page = 1
	}
	pageSize := atoiDefault(sp.Get("pageSize"), 10)
	if pageSize < 1 {
		pageSize = 1
	}
	if pageSize > 100 {
		pageSize = 100
	}
	sort := sp.Get("sort")
	if sort == "" {
		sort = defaultSort
	}
	order := "desc"
	if sp.Get("order") == "asc" {
		order = "asc"
	}
	return listParams{
		q:        strings.TrimSpace(sp.Get("q")),
		page:     page,
		pageSize: pageSize,
		sort:     sort,
		order:    order,
		offset:   (page - 1) * pageSize,
	}
}

func atoiDefault(s string, def int) int {
	if v, err := strconv.Atoi(s); err == nil {
		return v
	}
	return def
}

// paged is the standard list envelope returned to the frontend.
type paged struct {
	Items    any `json:"items"`
	Total    int `json:"total"`
	Page     int `json:"page"`
	PageSize int `json:"pageSize"`
}

func writePaged(w http.ResponseWriter, items any, total int, p listParams) {
	writeJSON(w, http.StatusOK, paged{Items: items, Total: total, Page: p.page, PageSize: p.pageSize})
}

// authorize resolves the signed-in user and checks a permission. On failure it
// writes the response and returns nil.
func (a *api) authorize(w http.ResponseWriter, r *http.Request, permission string) *store.User {
	user := a.requireUser(r)
	if user == nil {
		writeError(w, http.StatusUnauthorized, "not authenticated")
		return nil
	}
	perms, err := a.store.EffectivePermissions(user.ID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "permission check failed")
		return nil
	}
	if !containsStr(perms, permission) {
		writeError(w, http.StatusForbidden, "forbidden")
		return nil
	}
	return user
}

// currentTokenHash returns the SHA-256 of the request's session token, or "".
func (a *api) currentTokenHash(r *http.Request) string {
	c, err := r.Cookie(sessionCookie)
	if err != nil || c.Value == "" {
		return ""
	}
	return auth.HashToken(c.Value)
}

func containsStr(xs []string, target string) bool {
	for _, x := range xs {
		if x == target {
			return true
		}
	}
	return false
}

// --- validation (mirrors src/lib/validators.ts) ---

var emailRe = regexp.MustCompile(`^[^@\s]+@[^@\s]+\.[^@\s]+$`)

func validEmail(s string) bool { return emailRe.MatchString(s) }

// validPassword: >=8 chars, at least one letter and one digit.
func validPassword(s string) bool {
	if len(s) < 8 {
		return false
	}
	hasLetter, hasDigit := false, false
	for _, c := range s {
		switch {
		case c >= '0' && c <= '9':
			hasDigit = true
		case (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z'):
			hasLetter = true
		}
	}
	return hasLetter && hasDigit
}
