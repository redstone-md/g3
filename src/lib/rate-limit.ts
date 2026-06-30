import "server-only";

/**
 * Minimal in-memory failed-attempt limiter (fixed window).
 *
 * Suitable for a single server instance. For multi-instance / serverless
 * deployments, swap the `store` for a shared backend (Redis/Upstash) — the
 * exported function signatures can stay the same.
 */

interface Entry {
  count: number;
  resetAt: number;
}

// Survive dev HMR reloads.
const store: Map<string, Entry> =
  (globalThis as unknown as { __ribbonRateLimit?: Map<string, Entry> })
    .__ribbonRateLimit ?? new Map();
(
  globalThis as unknown as { __ribbonRateLimit?: Map<string, Entry> }
).__ribbonRateLimit = store;

function prune(now: number): void {
  if (store.size < 5000) return; // cheap cap; only sweep when it grows
  for (const [key, entry] of store) {
    if (entry.resetAt <= now) store.delete(key);
  }
}

/** Is this key currently blocked? Read-only — does not count an attempt. */
export function isBlocked(
  key: string,
  max: number,
): { blocked: boolean; retryAfterMs: number } {
  const entry = store.get(key);
  const now = Date.now();
  if (!entry || entry.resetAt <= now)
    return { blocked: false, retryAfterMs: 0 };
  return entry.count >= max
    ? { blocked: true, retryAfterMs: entry.resetAt - now }
    : { blocked: false, retryAfterMs: 0 };
}

/** Record one failed attempt against the key within the rolling window. */
export function recordFailure(key: string, windowMs: number): void {
  const now = Date.now();
  prune(now);
  const entry = store.get(key);
  if (!entry || entry.resetAt <= now) {
    store.set(key, { count: 1, resetAt: now + windowMs });
  } else {
    entry.count += 1;
  }
}

/** Clear a key (call on successful auth). */
export function clearAttempts(...keys: string[]): void {
  for (const key of keys) store.delete(key);
}
