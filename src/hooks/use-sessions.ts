import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import type { SessionDTO } from "@/lib/types";

const KEY = ["sessions"] as const;

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? "Request failed.");
  return body as T;
}

export function useSessions() {
  return useQuery({
    queryKey: KEY,
    queryFn: () => request<SessionDTO[]>("/api/account/sessions"),
  });
}

export function useRevokeSession() {
  const qc = useQueryClient();
  const t = useTranslations("settings");
  return useMutation({
    mutationFn: (id: string) =>
      request(`/api/account/sessions/${id}`, { method: "DELETE" }),
    onMutate: async (id: string) => {
      await qc.cancelQueries({ queryKey: KEY });
      const previous = qc.getQueryData<SessionDTO[]>(KEY);
      qc.setQueryData<SessionDTO[]>(KEY, (old) =>
        old?.filter((s) => s.id !== id),
      );
      return { previous };
    },
    onError: (e: Error, _id, ctx) => {
      if (ctx?.previous) qc.setQueryData(KEY, ctx.previous);
      toast.error(e.message);
    },
    onSuccess: () => toast.success(t("sessionRevoked")),
    onSettled: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useRevokeOtherSessions() {
  const qc = useQueryClient();
  const t = useTranslations("settings");
  return useMutation({
    mutationFn: () => request("/api/account/sessions", { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
      toast.success(t("signedOutOthers"));
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
