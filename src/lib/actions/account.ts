"use server";

import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import * as z from "zod";
import { adminUserCount, grantsAdmin } from "@/lib/admin-guard";
import { logAudit } from "@/lib/audit";
import { verifySession } from "@/lib/dal";
import { prisma } from "@/lib/db";
import { verifyPassword } from "@/lib/password";
import { deleteSession } from "@/lib/session";

export interface ActionResult {
  ok: boolean;
  error?: string;
}

const emailSchema = z.object({
  email: z.email().trim().toLowerCase(),
  currentPassword: z.string().min(1),
});

/** Change the signed-in user's email after confirming their password. */
export async function changeEmail(input: {
  email: string;
  currentPassword: string;
}): Promise<ActionResult> {
  const user = await verifySession();
  const t = await getTranslations("settings");

  const parsed = emailSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: t("invalidEmail") };

  const record = await prisma.user.findUnique({ where: { id: user.id } });
  if (
    !record ||
    !(await verifyPassword(parsed.data.currentPassword, record.passwordHash))
  ) {
    return { ok: false, error: t("currentIncorrect") };
  }

  const existing = await prisma.user.findUnique({
    where: { email: parsed.data.email },
  });
  if (existing && existing.id !== user.id) {
    return { ok: false, error: t("emailTaken") };
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { email: parsed.data.email },
  });
  await logAudit({
    action: "user.email_change",
    actorId: user.id,
    actorEmail: parsed.data.email,
    targetType: "user",
    targetId: user.id,
  });
  return { ok: true };
}

/** Permanently delete the signed-in user's own account (password-confirmed). */
export async function deleteAccount(input: {
  currentPassword: string;
}): Promise<ActionResult> {
  const user = await verifySession();
  const t = await getTranslations("settings");

  const record = await prisma.user.findUnique({ where: { id: user.id } });
  if (
    !record ||
    !(await verifyPassword(input.currentPassword, record.passwordHash))
  ) {
    return { ok: false, error: t("currentIncorrect") };
  }
  if (grantsAdmin(user.permissions) && (await adminUserCount()) <= 1) {
    return { ok: false, error: t("cannotDeleteLastAdmin") };
  }

  await prisma.user
    .update({ where: { id: user.id }, data: { roles: { set: [] } } })
    .catch(() => {});
  await logAudit({
    action: "user.self_delete",
    actorId: user.id,
    actorEmail: user.email,
    targetType: "user",
    targetId: user.id,
  });
  await prisma.user.delete({ where: { id: user.id } }).catch(() => {});
  await deleteSession();
  redirect("/login");
}
