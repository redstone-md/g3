"use server";

import { cookies } from "next/headers";
import { THEME_COOKIE } from "@/lib/auth-constants";
import { verifySession } from "@/lib/dal";
import { prisma } from "@/lib/db";
import { resolveTheme } from "@/lib/themes";

const ONE_YEAR = 60 * 60 * 24 * 365;

/** Persist the user's theme to the DB (cross-device truth) + SSR cookie hint. */
export async function setTheme(slug: string): Promise<void> {
  const user = await verifySession();
  const theme = resolveTheme(slug);

  await prisma.user.update({ where: { id: user.id }, data: { theme } });

  const store = await cookies();
  store.set(THEME_COOKIE, theme, {
    path: "/",
    maxAge: ONE_YEAR,
    sameSite: "lax",
  });
}
