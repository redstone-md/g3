/** TanStack Query optimistic helpers for list mutations. */

import type { QueryClient } from "@tanstack/react-query";
import type { PagedResult } from "@/lib/list-query";

type WithId = { id: string };
type PageSnapshot = [readonly unknown[], PagedResult<WithId> | undefined][];

/**
 * Optimistically drop an item by id from every cached page of a paginated list
 * (`[baseKey, "page", params]`). Cancels in-flight fetches, snapshots the caches
 * so the change can be rolled back, and decrements the total. Returns the
 * snapshot to stash as the mutation context for {@link rollbackPages}.
 */
export async function removeFromPages(
  qc: QueryClient,
  baseKey: readonly unknown[],
  id: string,
): Promise<PageSnapshot> {
  const filter = { queryKey: [...baseKey, "page"] };
  await qc.cancelQueries(filter);
  const previous = qc.getQueriesData<PagedResult<WithId>>(filter);
  qc.setQueriesData<PagedResult<WithId>>(filter, (old) =>
    old
      ? {
          ...old,
          items: old.items.filter((item) => item.id !== id),
          total: Math.max(0, old.total - 1),
        }
      : old,
  );
  return previous;
}

/** Restore the caches captured by {@link removeFromPages} (call in onError). */
export function rollbackPages(
  qc: QueryClient,
  snapshot: PageSnapshot | undefined,
): void {
  for (const [key, data] of snapshot ?? []) {
    qc.setQueryData(key, data);
  }
}
