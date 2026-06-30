"use server";

import { cookies } from "next/headers";
import { verifySession } from "@/lib/dal";
import { prisma } from "@/lib/db";
import { LOCALE_COOKIE, resolveLocale } from "@/lib/locales";

/** Persist the user's interface language to the DB + SSR cookie. */
export async function setLocale(value: string): Promise<void> {
  const user = await verifySession();
  const locale = resolveLocale(value);
  await prisma.user.update({ where: { id: user.id }, data: { locale } });
  (await cookies()).set(LOCALE_COOKIE, locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
}
