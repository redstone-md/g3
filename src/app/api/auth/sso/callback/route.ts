import { cookies } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import { THEME_COOKIE } from "@/lib/auth-constants";
import { isValidAvatar } from "@/lib/avatars";
import { prisma } from "@/lib/db";
import { LOCALE_COOKIE, resolveLocale } from "@/lib/locales";
import { randomToken } from "@/lib/oauth/crypto";
import { exchangeCode, fetchUserinfo } from "@/lib/oauth/sso-client";
import { createSession } from "@/lib/session";
import { resolveTheme } from "@/lib/themes";

const YEAR = {
  path: "/",
  maxAge: 60 * 60 * 24 * 365,
  sameSite: "lax" as const,
};

/** OAuth callback: exchange code, resolve the user, open a local session. */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const oauthError = searchParams.get("error");

  const store = await cookies();
  const verifier = store.get("sso_verifier")?.value;
  const savedState = store.get("sso_state")?.value;

  const fail = (reason: string) =>
    NextResponse.redirect(new URL(`/login?error=${reason}`, request.url));

  if (oauthError) return fail("sso_denied");
  if (!code || !state || !verifier || state !== savedState)
    return fail("sso_state");

  let email: string;
  let name: string | null;
  let picture: string | null | undefined;
  try {
    const tokens = await exchangeCode(code, verifier);
    const info = await fetchUserinfo(tokens.access_token);
    if (!info.email) return fail("sso_no_email");
    email = info.email.toLowerCase();
    name = info.name ?? null;
    picture = info.picture;
  } catch {
    return fail("sso_exchange");
  }

  // Find or provision the local account (email-trusted from the provider).
  let user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    const member = await prisma.role.findUnique({ where: { name: "Member" } });
    user = await prisma.user.create({
      data: {
        email,
        name,
        // Unusable password — SSO users cannot sign in with credentials.
        passwordHash: `sso:${randomToken(16)}`,
        avatar: isValidAvatar(picture) ? picture : null,
        roles: member ? { connect: { id: member.id } } : undefined,
      },
    });
  }

  await createSession(user.id);
  store.set(THEME_COOKIE, resolveTheme(user.theme), YEAR);
  store.set(LOCALE_COOKIE, resolveLocale(user.locale), YEAR);
  store.delete("sso_verifier");
  store.delete("sso_state");

  return NextResponse.redirect(new URL("/dashboard", request.url));
}
