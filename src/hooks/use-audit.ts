import { keepPreviousData, useQuery } from "@tanstack/react-query";
import type { ListParams } from "@/hooks/use-roles";
import type { PagedResult } from "@/lib/list-query";
import type { AuditLogDTO } from "@/lib/types";

function qs(params: ListParams): string {
  const sp = new URLSearchParams();
  if (params.q) sp.set("q", params.q);
  if (params.page) sp.set("page", String(params.page));
  if (params.pageSize) sp.set("pageSize", String(params.pageSize));
  return sp.toString();
}

export function useAuditPage(params: ListParams) {
  return useQuery({
    queryKey: ["audit", "page", params],
    queryFn: async () => {
      const res = await fetch(`/api/audit?${qs(params)}`);
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "Request failed.");
      return body as PagedResult<AuditLogDTO>;
    },
    placeholderData: keepPreviousData,
  });
}
