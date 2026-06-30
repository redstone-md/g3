"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import * as z from "zod";
import { logAudit } from "@/lib/audit";
import { THEME_COOKIE } from "@/lib/auth-constants";
import { getCurrentUser, verifySession } from "@/lib/dal";
import { prisma } from "@/lib/db";
import { LOCALE_COOKIE, resolveLocale } from "@/lib/locales";
import { MOTION_COOKIE, resolveMotion } from "@/lib/motion";
import { hashPassword, verifyPassword } from "@/lib/password";
import { clearAttempts, isBlocked, recordFailure } from "@/lib/rate-limit";
import { createSession, deleteSession } from "@/lib/session";
import { resolveTheme } from "@/lib/themes";
import { loginSchema } from "@/lib/validators";

// Brute-force policy.
const ATTEMPT_WINDOW_MS = 15 * 60 * 1000; // 15 min
const MAX_PER_IDENTITY = 5; // per IP+email
const MAX_PER_IP = 30; // per IP (distributed guessing)

async function clientIp(): Promise<string> {
  const h = await headers();
  return (
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    h.get("x-real-ip") ||
    "unknown"
  );
}

/** Only allow same-origin relative redirects to prevent open-redirect abuse. */
function safeNext(value: FormDataEntryValue | null): string {
  const next = typeof value === "string" ? value : "";
  return next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
}

export interface AuthFormState {
  error?: string;
}

/** Authenticate credentials and open a session. */
export async function login(
  _prev: AuthFormState | undefined,
  formData: FormData,
): Promise<AuthFormState> {
  const t = await getTranslations("auth");
  const ip = await clientIp();
  const rawEmail = String(formData.get("email") ?? "")
    .toLowerCase()
    .trim();
  const idKey = `login:${ip}:${rawEmail}`;
  const ipKey = `login-ip:${ip}`;

  // Block before doing any work (incl. expensive bcrypt) if rate-limited.
  const idBlock = isBlocked(idKey, MAX_PER_IDENTITY);
  const ipBlock = isBlocked(ipKey, MAX_PER_IP);
  if (idBlock.blocked || ipBlock.blocked) {
    const ms = Math.max(idBlock.retryAfterMs, ipBlock.retryAfterMs);
    return { error: t("tooManyAttempts", { minutes: Math.ceil(ms / 60000) }) };
  }

  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  // Generic message — never reveal which field was wrong.
  const invalid: AuthFormState = { error: t("invalidCredentials") };

  const fail = (): AuthFormState => {
    recordFailure(idKey, ATTEMPT_WINDOW_MS);
    recordFailure(ipKey, ATTEMPT_WINDOW_MS);
    return invalid;
  };

  if (!parsed.success) return fail();

  const user = await prisma.user.findUnique({
    where: { email: parsed.data.email },
  });
  if (!user) return fail();

  const ok = await verifyPassword(parsed.data.password, user.passwordHash);
  if (!ok) return fail();

  clearAttempts(idKey, ipKey);
  await createSession(user.id);
  await logAudit({
    action: "auth.login",
    actorId: user.id,
    actorEmail: user.email,
  });

  // Sync the SSR theme + locale hints from the account (cross-device).
  const cookieStore = await cookies();
  const cookieOpts = {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax" as const,
  };
  cookieStore.set(THEME_COOKIE, resolveTheme(user.theme), cookieOpts);
  cookieStore.set(MOTION_COOKIE, resolveMotion(user.motion), cookieOpts);
  cookieStore.set(LOCALE_COOKIE, resolveLocale(user.locale), cookieOpts);

  if (user.mustChangePassword) redirect("/account/password");
  redirect(safeNext(formData.get("next")));
}

/** End the current session and return to the login screen. */
export async function logout(): Promise<void> {
  const user = await getCurrentUser();
  if (user) {
    await logAudit({
      action: "auth.logout",
      actorId: user.id,
      actorEmail: user.email,
    });
  }
  await deleteSession();
  redirect("/login");
}

const changePasswordSchema = z
  .object({
    current: z.string().min(1, { error: "Enter your current password." }),
    next: z
      .string()
      .min(8, { error: "At least 8 characters." })
      .regex(/[a-zA-Z]/, { error: "Include a letter." })
      .regex(/[0-9]/, { error: "Include a number." }),
    confirm: z.string(),
  })
  .refine((d) => d.next === d.confirm, {
    error: "Passwords do not match.",
    path: ["confirm"],
  });

/** Change the signed-in user's password and clear the must-change flag. */
export async function changePassword(
  _prev: AuthFormState | undefined,
  formData: FormData,
): Promise<AuthFormState> {
  const user = await verifySession();
  const t = await getTranslations("auth");

  const parsed = changePasswordSchema.safeParse({
    current: formData.get("current"),
    next: formData.get("next"),
    confirm: formData.get("confirm"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? t("invalidInput") };
  }

  const record = await prisma.user.findUnique({ where: { id: user.id } });
  if (!record) return { error: t("accountNotFound") };

  const ok = await verifyPassword(parsed.data.current, record.passwordHash);
  if (!ok) return { error: t("currentIncorrect") };

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash: await hashPassword(parsed.data.next),
      mustChangePassword: false,
    },
  });
  await logAudit({
    action: "auth.password_change",
    actorId: user.id,
    actorEmail: user.email,
  });

  redirect("/dashboard");
}
