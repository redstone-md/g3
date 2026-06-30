package httpd

import (
	"net/http"

	"g3/internal/store"
)

// auditDTO matches src/lib/types.ts AuditLogDTO.
type auditDTO struct {
	ID         string  `json:"id"`
	Action     string  `json:"action"`
	ActorEmail *string `json:"actorEmail"`
	TargetType *string `json:"targetType"`
	TargetID   *string `json:"targetId"`
	IP         *string `json:"ip"`
	CreatedAt  string  `json:"createdAt"`
}

func toAuditDTO(e store.AuditEntry) auditDTO {
	return auditDTO{
		ID: e.ID, Action: e.Action,
		ActorEmail: nsPtr(e.ActorEmail), TargetType: nsPtr(e.TargetType),
		TargetID: nsPtr(e.TargetID), IP: nsPtr(e.IP), CreatedAt: e.CreatedAt,
	}
}

func (a *api) listAudit(w http.ResponseWriter, r *http.Request) {
	if a.authorize(w, r, "audit.read") == nil {
		return
	}
	p := parseList(r, "createdAt")
	rows, total, err := a.store.ListAudit(p.q, p.pageSize, p.offset)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not list audit log")
		return
	}
	dtos := make([]auditDTO, 0, len(rows))
	for _, e := range rows {
		dtos = append(dtos, toAuditDTO(e))
	}
	writePaged(w, dtos, total, p)
}
