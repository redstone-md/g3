"use client";

import { NextIntlClientProvider } from "next-intl";
import { useEffect, useState } from "react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { DEFAULT_LOCALE, type Locale, resolveLocale } from "@/lib/locales";
import { NavProgress } from "@/providers/nav-progress";
import { SmoothScroll } from "@/providers/smooth-scroll";
import enMessages from "../../../messages/en.json";
import ruMessages from "../../../messages/ru.json";

// Both catalogs ship in the bundle; the active one is chosen on the client.
const MESSAGES: Record<Locale, typeof ruMessages> = {
  ru: ruMessages,
  en: enMessages as typeof ruMessages,
};

function readLocaleCookie(): Locale {
  if (typeof document === "undefined") return DEFAULT_LOCALE;
  const match = document.cookie.match(/(?:^|;\s*)ribbon_locale=([^;]*)/);
  return resolveLocale(match ? decodeURIComponent(match[1]) : null);
}

/**
 * Client i18n boundary for the static SPA. There is no per-request server
 * config: we start at the default locale (matching the prerendered HTML, so
 * hydration is stable) then switch to the cookie locale after mount.
 */
export function IntlProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocale] = useState<Locale>(DEFAULT_LOCALE);

  // Run once on mount; React bails out when the cookie matches the default.
  useEffect(() => {
    setLocale(readLocaleCookie());
  }, []);

  return (
    <NextIntlClientProvider locale={locale} messages={MESSAGES[locale]}>
      <SmoothScroll>
        <NavProgress>
          <TooltipProvider delayDuration={300}>{children}</TooltipProvider>
        </NavProgress>
      </SmoothScroll>
    </NextIntlClientProvider>
  );
}
