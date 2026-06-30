import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import type { AccountDTO } from "@/lib/types";

const KEY = ["accounts"] as const;

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? "Request failed.");
  return body as T;
}

/** Linked Google Drive storage accounts. */
export function useAccounts() {
  return useQuery({
    queryKey: KEY,
    queryFn: () => request<AccountDTO[]>("/api/accounts"),
  });
}

export function useRefreshAccount() {
  const qc = useQueryClient();
  const t = useTranslations("accounts");
  return useMutation({
    mutationFn: (id: string) =>
      request(`/api/accounts/${id}/refresh`, { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
      toast.success(t("refreshed"));
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteAccount() {
  const qc = useQueryClient();
  const t = useTranslations("accounts");
  return useMutation({
    mutationFn: (id: string) =>
      request(`/api/accounts/${id}`, { method: "DELETE" }),
    onMutate: async (id: string) => {
      await qc.cancelQueries({ queryKey: KEY });
      const previous = qc.getQueryData<AccountDTO[]>(KEY);
      qc.setQueryData<AccountDTO[]>(KEY, (old) =>
        old?.filter((a) => a.id !== id),
      );
      return { previous };
    },
    onError: (e: Error, _id, ctx) => {
      if (ctx?.previous) qc.setQueryData(KEY, ctx.previous);
      toast.error(e.message);
    },
    onSuccess: () => toast.success(t("removed")),
    onSettled: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useSetAccountWeight() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, weight }: { id: string; weight: number }) =>
      request(`/api/accounts/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ weight }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
    onError: (e: Error) => toast.error(e.message),
  });
}
