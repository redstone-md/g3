package httpd

import (
	"encoding/json"
	"net/http"
	"strings"

	"g3/internal/auth"
	"g3/internal/store"
)

// userDTO is the client-facing user shape (matches src/lib/types.ts UserDTO).
type userDTO struct {
	ID                 string          `json:"id"`
	Email              string          `json:"email"`
	Name               *string         `json:"name"`
	MustChangePassword bool            `json:"mustChangePassword"`
	Avatar             *string         `json:"avatar"`
	CreatedAt          string          `json:"createdAt"`
	Roles              []store.RoleRef `json:"roles"`
}

func toUserDTO(u store.UserListItem) userDTO {
	roles := u.Roles
	if roles == nil {
		roles = []store.RoleRef{}
	}
	return userDTO{
		ID:                 u.ID,
		Email:              u.Email,
		Name:               nsPtr(u.Name),
		MustChangePassword: u.MustChangePassword,
		Avatar:             nsPtr(u.Avatar),
		CreatedAt:          u.CreatedAt,
		Roles:              roles,
	}
}

func (a *api) listUsers(w http.ResponseWriter, r *http.Request) {
	if a.authorize(w, r, "users.read") == nil {
		return
	}
	p := parseList(r, "createdAt")
	rows, total, err := a.store.ListUsers(p.q, p.sort, p.order, p.pageSize, p.offset)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not list users")
		return
	}
	dtos := make([]userDTO, 0, len(rows))
	for _, u := range rows {
		dtos = append(dtos, toUserDTO(u))
	}
	writePaged(w, dtos, total, p)
}

type createUserBody struct {
	Email    string   `json:"email"`
	Name     string   `json:"name"`
	Password string   `json:"password"`
	RoleIDs  []string `json:"roleIds"`
}

func (a *api) createUser(w http.ResponseWriter, r *http.Request) {
	actor := a.authorize(w, r, "users.create")
	if actor == nil {
		return
	}
	var body createUserBody
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request")
		return
	}
	email := strings.ToLower(strings.TrimSpace(body.Email))
	if !validEmail(email) {
		writeError(w, http.StatusBadRequest, "Enter a valid email.")
		return
	}
	if !validPassword(body.Password) {
		writeError(w, http.StatusBadRequest, "Password must be 8+ chars with a letter and a number.")
		return
	}
	if taken, _ := a.store.EmailExists(email, ""); taken {
		writeError(w, http.StatusConflict, "That email is already in use.")
		return
	}

	hash, err := auth.HashPassword(body.Password)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not hash password")
		return
	}
	id, err := a.store.CreateUser(email, strings.TrimSpace(body.Name), hash, body.RoleIDs)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not create user")
		return
	}
	a.store.LogAuditFull("user.create", actor.ID, actor.Email, "user", id, clientIP(r))

	refs, _ := a.store.RolesForUserRefs(id)
	name := strings.TrimSpace(body.Name)
	var namePtr *string
	if name != "" {
		namePtr = &name
	}
	writeJSON(w, http.StatusCreated, userDTO{
		ID: id, Email: email, Name: namePtr, MustChangePassword: false,
		Avatar: nil, CreatedAt: "", Roles: refs,
	})
}

type updateUserBody struct {
	Name     *string   `json:"name"`
	RoleIDs  *[]string `json:"roleIds"`
	Password *string   `json:"password"`
}

func (a *api) updateUser(w http.ResponseWriter, r *http.Request) {
	actor := a.authorize(w, r, "users.update")
	if actor == nil {
		return
	}
	id := r.PathValue("id")
	var body updateUserBody
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request")
		return
	}

	var passwordHash *string
	if body.Password != nil && *body.Password != "" {
		if !validPassword(*body.Password) {
			writeError(w, http.StatusBadRequest, "Password must be 8+ chars with a letter and a number.")
			return
		}
		h, err := auth.HashPassword(*body.Password)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "could not hash password")
			return
		}
		passwordHash = &h
	}

	if err := a.store.UpdateUser(id, body.Name, body.RoleIDs, passwordHash); err != nil {
		writeError(w, http.StatusInternalServerError, "could not update user")
		return
	}
	a.store.LogAuditFull("user.update", actor.ID, actor.Email, "user", id, clientIP(r))
	writeJSON(w, http.StatusOK, map[string]string{"id": id})
}

func (a *api) deleteUser(w http.ResponseWriter, r *http.Request) {
	actor := a.authorize(w, r, "users.delete")
	if actor == nil {
		return
	}
	id := r.PathValue("id")
	if id == actor.ID {
		writeError(w, http.StatusConflict, "Use account settings to delete your own account.")
		return
	}
	if last, _ := a.store.IsLastAdmin(id); last {
		writeError(w, http.StatusConflict, "Cannot delete the last administrator.")
		return
	}
	if _, err := a.store.UserByID(id); err != nil {
		writeError(w, http.StatusNotFound, "user not found")
		return
	}
	if err := a.store.DeleteUser(id); err != nil {
		writeError(w, http.StatusInternalServerError, "could not delete user")
		return
	}
	a.store.LogAuditFull("user.delete", actor.ID, actor.Email, "user", id, clientIP(r))
	writeJSON(w, http.StatusOK, map[string]string{"id": id})
}
