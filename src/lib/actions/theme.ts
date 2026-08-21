"use client";

/** Persist the user's theme to the account + refresh the SSR cookie hint. */

import { api } from "@/lib/api";
import { THEME_COOKIE } from "@/lib/auth-constants";
import { resolveTheme } from "@/lib/themes";

const ONE_YEAR = 60 * 60 * 24 * 365;

export async function setTheme(slug: string): Promise<void> {
  const theme = resolveTheme(slug);
  document.cookie = `${THEME_COOKIE}=${theme};path=/;max-age=${ONE_YEAR};samesite=lax`;
  try {
    await api("/api/account/prefs", {
      method: "PATCH",
      body: JSON.stringify({ theme }),
    });
  } catch {
    // Class already applied client-side; persistence is best-effort.
  }
}
