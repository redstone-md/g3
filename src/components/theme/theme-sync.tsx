"use client";

import { useEffect } from "react";
import { THEME_COOKIE } from "@/lib/auth-constants";
import { applyThemeClass } from "@/lib/themes";

const ONE_YEAR = 60 * 60 * 24 * 365;

/**
 * Reconciles the rendered theme with the account's DB theme on load. If this
 * device's cookie was stale (theme changed on another device), this corrects
 * the <html> class and refreshes the cookie. Renders nothing.
 */
export function ThemeSync({ theme }: { theme: string }) {
  useEffect(() => {
    applyThemeClass(theme);
    document.cookie = `${THEME_COOKIE}=${theme};path=/;max-age=${ONE_YEAR};samesite=lax`;
  }, [theme]);

  return null;
}
