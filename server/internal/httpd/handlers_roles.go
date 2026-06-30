package httpd

import (
	"encoding/json"
	"net/http"
	"strings"

	"g3/internal/store"
)

// roleDTO matches src/lib/types.ts RoleDTO.
type roleDTO struct {
	ID          string   `json:"id"`
	Name        string   `json:"name"`
	Description *string  `json:"description"`
	Permissions []string `json:"permissions"`
	ParentIDs   []string `json:"parentIds"`
	IsSystem    bool     `json:"isSystem"`
	UserCount   int      `json:"userCount"`
	CreatedAt   string   `json:"createdAt"`
}

func toRoleDTO(r store.RoleDetail) roleDTO {
	perms := r.Permissions
	if perms == nil {
		perms = []string{}
	}
	parents := r.ParentIDs
	if parents == nil {
		parents = []string{}
	}
	return roleDTO{
		ID: r.ID, Name: r.Name, Description: nsPtr(r.Description),
		Permissions: perms, ParentIDs: parents, IsSystem: r.IsSystem,
		UserCount: r.UserCount, CreatedAt: r.CreatedAt,
	}
}

func (a *api) listRoles(w http.ResponseWriter, r *http.Request) {
	if a.authorize(w, r, "roles.read") == nil {
		return
	}
	p := parseList(r, "createdAt")
	rows, total, err := a.store.ListRoles(p.q, p.sort, p.order, p.pageSize, p.offset)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not list roles")
		return
	}
	dtos := make([]roleDTO, 0, len(rows))
	for _, role := range rows {
		dtos = append(dtos, toRoleDTO(role))
	}
	writePaged(w, dtos, total, p)
}

type roleBody struct {
	Name        string   `json:"name"`
	Description  string   `json:"description"`
	Permissions []string `json:"permissions"`
	ParentIDs   []string `json:"parentIds"`
}

func (b roleBody) valid() (string, bool) {
	name := strings.TrimSpace(b.Name)
	if len(name) < 2 || len(name) > 40 {
		return "Role name must be 2-40 characters.", false
	}
	return "", true
}

func (a *api) createRole(w http.ResponseWriter, r *http.Request) {
	actor := a.authorize(w, r, "roles.create")
	if actor == nil {
		return
	}
	var body roleBody
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request")
		return
	}
	if msg, ok := body.valid(); !ok {
		writeError(w, http.StatusBadRequest, msg)
		return
	}
	name := strings.TrimSpace(body.Name)
	if taken, _ := a.store.RoleNameExists(name, ""); taken {
		writeError(w, http.StatusConflict, "A role with that name already exists.")
		return
	}
	id, err := a.store.CreateRole(name, strings.TrimSpace(body.Description), body.Permissions, body.ParentIDs)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not create role")
		return
	}
	a.store.LogAuditFull("role.create", actor.ID, actor.Email, "role", id, clientIP(r))

	role, err := a.store.RoleByID(id)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "created but could not load role")
		return
	}
	writeJSON(w, http.StatusCreated, toRoleDTO(*role))
}

func (a *api) updateRole(w http.ResponseWriter, r *http.Request) {
	actor := a.authorize(w, r, "roles.update")
	if actor == nil {
		return
	}
	id := r.PathValue("id")
	var body roleBody
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request")
		return
	}
	if msg, ok := body.valid(); !ok {
		writeError(w, http.StatusBadRequest, msg)
		return
	}
	name := strings.TrimSpace(body.Name)
	if taken, _ := a.store.RoleNameExists(name, id); taken {
		writeError(w, http.StatusConflict, "A role with that name already exists.")
		return
	}
	if err := a.store.UpdateRole(id, name, strings.TrimSpace(body.Description), body.Permissions, body.ParentIDs); err != nil {
		writeError(w, http.StatusInternalServerError, "could not update role")
		return
	}
	a.store.LogAuditFull("role.update", actor.ID, actor.Email, "role", id, clientIP(r))
	writeJSON(w, http.StatusOK, map[string]string{"id": id})
}

func (a *api) deleteRole(w http.ResponseWriter, r *http.Request) {
	actor := a.authorize(w, r, "roles.delete")
	if actor == nil {
		return
	}
	id := r.PathValue("id")
	role, err := a.store.RoleByID(id)
	if err != nil {
		writeError(w, http.StatusNotFound, "role not found")
		return
	}
	if role.IsSystem {
		writeError(w, http.StatusConflict, "System roles cannot be deleted.")
		return
	}
	if err := a.store.DeleteRole(id); err != nil {
		writeError(w, http.StatusInternalServerError, "could not delete role")
		return
	}
	a.store.LogAuditFull("role.delete", actor.ID, actor.Email, "role", id, clientIP(r))
	writeJSON(w, http.StatusOK, map[string]string{"id": id})
}
