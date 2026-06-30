import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import type { ListParams } from "@/hooks/use-roles";
import type { PagedResult } from "@/lib/list-query";
import { removeFromPages, rollbackPages } from "@/lib/optimistic";
import type { UserDTO } from "@/lib/types";
import type { CreateUserInput, UpdateUserInput } from "@/lib/validators";

const USERS_KEY = ["users"] as const;

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

/** Paginated/searchable/sortable users for the table. */
export function useUsersPage(params: ListParams) {
  return useQuery({
    queryKey: [...USERS_KEY, "page", params],
    queryFn: () => request<PagedResult<UserDTO>>(`/api/users?${qs(params)}`),
    placeholderData: keepPreviousData,
  });
}

export function useCreateUser() {
  const qc = useQueryClient();
  const t = useTranslations("users");
  return useMutation({
    mutationFn: (input: CreateUserInput) =>
      request<UserDTO>("/api/users", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: USERS_KEY });
      toast.success(t("created"));
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateUser() {
  const qc = useQueryClient();
  const t = useTranslations("users");
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateUserInput }) =>
      request<{ id: string }>(`/api/users/${id}`, {
        method: "PATCH",
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: USERS_KEY });
      toast.success(t("updated"));
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteUser() {
  const qc = useQueryClient();
  const t = useTranslations("users");
  return useMutation({
    mutationFn: (id: string) =>
      request<{ id: string }>(`/api/users/${id}`, { method: "DELETE" }),
    onMutate: (id: string) => removeFromPages(qc, USERS_KEY, id),
    onError: (e: Error, _id, snapshot) => {
      rollbackPages(qc, snapshot);
      toast.error(e.message);
    },
    onSuccess: () => toast.success(t("deleted")),
    onSettled: () => qc.invalidateQueries({ queryKey: USERS_KEY }),
  });
}
