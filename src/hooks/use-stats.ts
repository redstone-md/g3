import { useQuery } from "@tanstack/react-query";

export interface StatsDTO {
  buckets: number;
  objects: number;
  totalSize: number;
  accounts: number;
  connectedAccounts: number;
  poolUsage: number;
  poolLimit: number;
}

async function request<T>(url: string): Promise<T> {
  const res = await fetch(url);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? "Request failed.");
  return body as T;
}

export function useStats() {
  return useQuery({
    queryKey: ["stats"],
    queryFn: () => request<StatsDTO>("/api/stats"),
  });
}
