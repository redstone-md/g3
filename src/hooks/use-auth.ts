"use client";

import { useQuery } from "@tanstack/react-query";
import type { AuthUser } from "@/components/auth/auth-context";
import { api } from "@/lib/api";

/** TanStack Query key for the signed-in user. */
export const ME_KEY = ["me"] as const;

/**
 * Server-state source for the signed-in user. `retry: false` so an unauthorized
 * response surfaces immediately (the shell redirects to /login on error).
 */
export function useMeQuery() {
  return useQuery({
    queryKey: ME_KEY,
    queryFn: () => api<AuthUser>("/api/me"),
    retry: false,
    staleTime: 60_000,
  });
}
