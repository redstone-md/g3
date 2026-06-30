"use server";

import { isValidAvatar } from "@/lib/avatars";
import { verifySession } from "@/lib/dal";
import { prisma } from "@/lib/db";
import { profileSchema } from "@/lib/validators";

/** Update the signed-in user's own profile (name + preset avatar). */
export async function updateProfile(input: {
  name: string;
  avatar: string | null;
}): Promise<{ ok: boolean; error?: string }> {
  const user = await verifySession();
  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid profile data." };

  const avatar =
    parsed.data.avatar && isValidAvatar(parsed.data.avatar)
      ? parsed.data.avatar
      : null;

  await prisma.user.update({
    where: { id: user.id },
    data: { name: parsed.data.name || null, avatar },
  });
  return { ok: true };
}

/** Toggle the signed-in user's native-notification preference. */
export async function setNotificationsEnabled(enabled: boolean): Promise<void> {
  const user = await verifySession();
  await prisma.user.update({
    where: { id: user.id },
    data: { notificationsEnabled: enabled },
  });
}
