import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import type { BucketDTO } from "@/lib/types";

const KEY = ["buckets"] as const;

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? "Request failed.");
  return body as T;
}

export function useBuckets() {
  return useQuery({
    queryKey: KEY,
    queryFn: () => request<BucketDTO[]>("/api/buckets"),
  });
}

export function useCreateBucket() {
  const qc = useQueryClient();
  const t = useTranslations("buckets");
  return useMutation({
    mutationFn: (name: string) =>
      request<BucketDTO>("/api/buckets", {
        method: "POST",
        body: JSON.stringify({ name }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
      toast.success(t("created"));
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteBucket() {
  const qc = useQueryClient();
  const t = useTranslations("buckets");
  return useMutation({
    mutationFn: (id: string) =>
      request(`/api/buckets/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
      toast.success(t("deleted"));
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
