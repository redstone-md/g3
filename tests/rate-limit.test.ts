import { describe, expect, it } from "vitest";
import { clearAttempts, isBlocked, recordFailure } from "@/lib/rate-limit";

describe("rate limiter", () => {
  it("blocks after reaching the max and clears on reset", () => {
    const key = `test:${Math.random()}`;
    const max = 3;
    const window = 60_000;

    expect(isBlocked(key, max).blocked).toBe(false);
    recordFailure(key, window);
    recordFailure(key, window);
    expect(isBlocked(key, max).blocked).toBe(false); // 2 < 3
    recordFailure(key, window);
    const blocked = isBlocked(key, max);
    expect(blocked.blocked).toBe(true);
    expect(blocked.retryAfterMs).toBeGreaterThan(0);

    clearAttempts(key);
    expect(isBlocked(key, max).blocked).toBe(false);
  });
});
