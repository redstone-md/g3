import { type NextRequest, NextResponse } from "next/server";
import { getTokenSubject } from "@/lib/oauth/server";

/** OAuth/OIDC-style userinfo endpoint. Requires a Bearer access token. */
export async function GET(request: NextRequest) {
  const auth = request.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "invalid_token" }, { status: 401 });
  }

  const subject = await getTokenSubject(auth.slice(7).trim());
  if (!subject) {
    return NextResponse.json({ error: "invalid_token" }, { status: 401 });
  }

  const { user, scope } = subject;
  const scopes = scope.split(" ");
  const claims: Record<string, unknown> = { sub: user.id };
  if (scopes.includes("profile")) {
    claims.name = user.name;
    claims.picture = user.avatar;
  }
  if (scopes.includes("email")) {
    claims.email = user.email;
  }

  return NextResponse.json(claims, {
    headers: { "Cache-Control": "no-store" },
  });
}
