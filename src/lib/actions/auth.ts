"use client";

/**
 * Auth actions — client implementations that call the Go backend.
 *
 * These keep the exact signatures of the former Next.js server actions so the
 * login / change-password forms (used with `useActionState` / `<form action>`)
 * and the user-menu sign-out work unchanged. Success paths navigate with a hard
 * `window.location` redirect, which also re-applies the SSR theme/locale cookies.
 */

import { api, apiErrorMessage } from "@/lib/api";
import { THEME_COOKIE } from "@/lib/auth-constants";
import { LOCALE_COOKIE } from "@/lib/locales";
import { MOTION_COOKIE } from "@/lib/motion";

export interface AuthFormState {
  error?: string;
}

const ONE_YEAR = 60 * 60 * 24 * 365;

function setCookie(name: string, value: string): void {
  document.cookie = `${name}=${value};path=/;max-age=${ONE_YEAR};samesite=lax`;
}

/** Only allow same-origin relative redirects to prevent open-redirect abuse. */
function safeNext(value: FormDataEntryValue | null): string {
  const next = typeof value === "string" ? value : "";
  return next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
}

interface LoginResponse {
  mustChangePassword: boolean;
  theme: string;
  motion: string;
  locale: string;
}

/** Authenticate credentials and open a session, then redirect. */
export async function login(
  _prev: AuthFormState | undefined,
  formData: FormData,
): Promise<AuthFormState> {
  try {
    const res = await api<LoginResponse>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({
        email: String(formData.get("email") ?? ""),
        password: String(formData.get("password") ?? ""),
      }),
    });
    // Sync the fast SSR hints from the account (cross-device).
    setCookie(THEME_COOKIE, res.theme);
    setCookie(MOTION_COOKIE, res.motion);
    setCookie(LOCALE_COOKIE, res.locale);
    window.location.assign(
      res.mustChangePassword
        ? "/account/password"
        : safeNext(formData.get("next")),
    );
    return {};
  } catch (error) {
    return { error: apiErrorMessage(error, "Sign-in failed.") };
  }
}

/** End the current session and return to the login screen. */
export async function logout(_formData?: FormData): Promise<void> {
  try {
    await api("/api/auth/logout", { method: "POST" });
  } catch {
    // Ignore — we redirect to login regardless.
  }
  window.location.assign("/login");
}

/** Change the signed-in user's password and clear the must-change flag. */
export async function changePassword(
  _prev: AuthFormState | undefined,
  formData: FormData,
): Promise<AuthFormState> {
  const next = String(formData.get("next") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  if (next !== confirm) return { error: "Passwords do not match." };

  try {
    await api("/api/account/password", {
      method: "POST",
      body: JSON.stringify({
        current: String(formData.get("current") ?? ""),
        next,
        confirm,
      }),
    });
    window.location.assign("/dashboard");
    return {};
  } catch (error) {
    return { error: apiErrorMessage(error, "Could not change password.") };
  }
}
