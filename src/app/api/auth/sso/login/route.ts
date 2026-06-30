import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { buildAuthorizeUrl, isSsoConfigured } from "@/lib/oauth/sso-client";

const TEMP_COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: 600, // 10 minutes
};

/** Start the SSO flow: stash PKCE verifier + state, redirect to the provider. */
export async function GET() {
  if (!isSsoConfigured()) {
    return NextResponse.json(
      { error: "SSO is not configured." },
      { status: 404 },
    );
  }

  const { url, verifier, state } = buildAuthorizeUrl();
  const store = await cookies();
  store.set("sso_verifier", verifier, TEMP_COOKIE_OPTS);
  store.set("sso_state", state, TEMP_COOKIE_OPTS);

  return NextResponse.redirect(url);
}
