import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import type { PagedResult } from "@/lib/list-query";
import { removeFromPages, rollbackPages } from "@/lib/optimistic";
import type { RoleDTO } from "@/lib/types";
import type { RoleInput } from "@/lib/validators";

const ROLES_KEY = ["roles"] as const;

export interface ListParams {
  q?: string;
  page?: number;
  pageSize?: number;
  sort?: string;
  order?: "asc" | "desc";
}

function qs(params: ListParams): string {
  const sp = new URLSearchParams();
  if (params.q) sp.set("q", params.q);
  if (params.page) sp.set("page", String(params.page));
  if (params.pageSize) sp.set("pageSize", String(params.pageSize));
  if (params.sort) sp.set("sort", params.sort);
  if (params.order) sp.set("order", params.order);
  return sp.toString();
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? "Request failed.");
  return body as T;
}

/** Paginated/searchable/sortable roles for the table. */
export function useRolesPage(params: ListParams) {
  return useQuery({
    queryKey: [...ROLES_KEY, "page", params],
    queryFn: () => request<PagedResult<RoleDTO>>(`/api/roles?${qs(params)}`),
    placeholderData: keepPreviousData,
  });
}

/** Full role list for pickers (capped). */
export function useRoles() {
  return useQuery({
    queryKey: [...ROLES_KEY, "all"],
    queryFn: async () =>
      (await request<PagedResult<RoleDTO>>("/api/roles?pageSize=100")).items,
  });
}

export function useCreateRole() {
  const qc = useQueryClient();
  const t = useTranslations("roles");
  return useMutation({
    mutationFn: (input: RoleInput) =>
      request<RoleDTO>("/api/roles", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ROLES_KEY });
      toast.success(t("created"));
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateRole() {
  const qc = useQueryClient();
  const t = useTranslations("roles");
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: RoleInput }) =>
      request<{ id: string }>(`/api/roles/${id}`, {
        method: "PATCH",
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ROLES_KEY });
      toast.success(t("updated"));
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteRole() {
  const qc = useQueryClient();
  const t = useTranslations("roles");
  return useMutation({
    mutationFn: (id: string) =>
      request<{ id: string }>(`/api/roles/${id}`, { method: "DELETE" }),
    onMutate: (id: string) => removeFromPages(qc, ROLES_KEY, id),
    onError: (e: Error, _id, snapshot) => {
      rollbackPages(qc, snapshot);
      toast.error(e.message);
    },
    onSuccess: () => toast.success(t("deleted")),
    onSettled: () => qc.invalidateQueries({ queryKey: ROLES_KEY }),
  });
}
