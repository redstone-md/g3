import { cookies } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { LOCALE_COOKIE, resolveLocale } from "@/lib/locales";

// No i18n routing — the active locale comes from a cookie (synced to the
// account on login / language change).
export default getRequestConfig(async () => {
  const cookie = (await cookies()).get(LOCALE_COOKIE)?.value;
  const locale = resolveLocale(cookie);
  const messages = (await import(`../../messages/${locale}.json`)).default;
  return { locale, messages };
});
