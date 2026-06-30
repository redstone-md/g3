import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import type { AccessKeyDTO, CreatedKeyDTO } from "@/lib/types";

const KEY = ["keys"] as const;

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? "Request failed.");
  return body as T;
}

export function useAccessKeys() {
  return useQuery({
    queryKey: KEY,
    queryFn: () => request<AccessKeyDTO[]>("/api/keys"),
  });
}

export function useCreateKey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (label: string) =>
      request<CreatedKeyDTO>("/api/keys", {
        method: "POST",
        body: JSON.stringify({ label }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteKey() {
  const qc = useQueryClient();
  const t = useTranslations("keys");
  return useMutation({
    mutationFn: (id: string) =>
      request(`/api/keys/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
      toast.success(t("revoked"));
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
