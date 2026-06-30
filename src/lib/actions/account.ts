"use client";

/** Account self-service actions — client calls to the Go backend. */

import { api, apiErrorMessage } from "@/lib/api";

export interface ActionResult {
  ok: boolean;
  error?: string;
}

/** Change the signed-in user's email after confirming their password. */
export async function changeEmail(input: {
  email: string;
  currentPassword: string;
}): Promise<ActionResult> {
  try {
    await api("/api/account/email", {
      method: "POST",
      body: JSON.stringify(input),
    });
    return { ok: true };
  } catch (error) {
    return { ok: false, error: apiErrorMessage(error, "Could not change email.") };
  }
}

/** Permanently delete the signed-in user's own account (password-confirmed). */
export async function deleteAccount(input: {
  currentPassword: string;
}): Promise<ActionResult> {
  try {
    await api("/api/account", {
      method: "DELETE",
      body: JSON.stringify(input),
    });
    window.location.assign("/login");
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: apiErrorMessage(error, "Could not delete account."),
    };
  }
}
