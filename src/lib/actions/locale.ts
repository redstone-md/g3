"use client";

/**
 * Persist the user's interface language to the account + cookie, then reload so
 * the static SPA re-picks the message catalog for the new locale.
 */

import { api } from "@/lib/api";
import { LOCALE_COOKIE, resolveLocale } from "@/lib/locales";

const ONE_YEAR = 60 * 60 * 24 * 365;

export async function setLocale(value: string): Promise<void> {
  const locale = resolveLocale(value);
  document.cookie = `${LOCALE_COOKIE}=${locale};path=/;max-age=${ONE_YEAR};samesite=lax`;
  try {
    await api("/api/account/prefs", {
      method: "PATCH",
      body: JSON.stringify({ locale }),
    });
  } catch {
    // Best-effort persistence; the cookie already drives the reload below.
  }
  window.location.reload();
}
