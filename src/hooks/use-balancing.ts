import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

const KEY = ["balancing"] as const;

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? "Request failed.");
  return body as T;
}

export type BalancingStrategy =
  | "round_robin"
  | "least_used"
  | "fill_first"
  | "hash";

export function useBalancing() {
  return useQuery({
    queryKey: KEY,
    queryFn: () =>
      request<{ strategy: BalancingStrategy }>("/api/settings/balancing"),
  });
}

export function useSetBalancing() {
  const qc = useQueryClient();
  const t = useTranslations("buckets");
  return useMutation({
    mutationFn: (strategy: BalancingStrategy) =>
      request("/api/settings/balancing", {
        method: "PUT",
        body: JSON.stringify({ strategy }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
      toast.success(t("balancingSaved"));
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
