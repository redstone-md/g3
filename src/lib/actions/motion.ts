"use client";

/** Persist the user's animation preset to the account + refresh the SSR cookie. */

import { api } from "@/lib/api";
import { MOTION_COOKIE, resolveMotion } from "@/lib/motion";

const ONE_YEAR = 60 * 60 * 24 * 365;

export async function setMotion(value: string): Promise<void> {
  const motion = resolveMotion(value);
  document.cookie = `${MOTION_COOKIE}=${motion};path=/;max-age=${ONE_YEAR};samesite=lax`;
  try {
    await api("/api/account/prefs", {
      method: "PATCH",
      body: JSON.stringify({ motion }),
    });
  } catch {
    // Class already applied client-side; persistence is best-effort.
  }
}
