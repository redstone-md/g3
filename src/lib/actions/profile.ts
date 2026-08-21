"use client";

/** Profile + notification preference actions — client calls to the Go backend. */

import { api, apiErrorMessage } from "@/lib/api";

/** Update the signed-in user's own profile (name + preset avatar). */
export async function updateProfile(input: {
  name: string;
  avatar: string | null;
}): Promise<{ ok: boolean; error?: string }> {
  try {
    await api("/api/account/profile", {
      method: "PATCH",
      body: JSON.stringify(input),
    });
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: apiErrorMessage(error, "Could not save profile."),
    };
  }
}

/** Toggle the signed-in user's native-notification preference. */
export async function setNotificationsEnabled(enabled: boolean): Promise<void> {
  try {
    await api("/api/account/prefs", {
      method: "PATCH",
      body: JSON.stringify({ notificationsEnabled: enabled }),
    });
  } catch {
    // Non-critical UI preference; ignore failures.
  }
}
