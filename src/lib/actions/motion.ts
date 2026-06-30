"use server";

import { cookies } from "next/headers";
import { verifySession } from "@/lib/dal";
import { prisma } from "@/lib/db";
import { MOTION_COOKIE, resolveMotion } from "@/lib/motion";

/** Persist the user's animation preset to the DB + SSR cookie. */
export async function setMotion(value: string): Promise<void> {
  const user = await verifySession();
  const motion = resolveMotion(value);
  await prisma.user.update({ where: { id: user.id }, data: { motion } });
  (await cookies()).set(MOTION_COOKIE, motion, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
}
