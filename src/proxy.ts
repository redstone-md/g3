import { type NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth-constants";

/**
 * Optimistic auth gate. Only inspects cookie *presence* — the authoritative,
 * DB-backed check lives in the Data Access Layer (`verifySession`) and in every
 * route handler. This keeps the proxy fast and avoids DB work on every request.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSession = request.cookies.has(SESSION_COOKIE);
  const isLogin = pathname === "/login";
  // OAuth endpoints handle their own auth (Bearer/secret, or self-redirect to login).
  const isPublic = isLogin || pathname.startsWith("/oauth");

  if (!hasSession && !isPublic) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // NOTE: we intentionally do NOT redirect /login → /dashboard on cookie
  // presence. A revoked/expired session leaves a stale cookie; the DB check in
  // the dashboard layout would bounce back to /login → infinite loop. The
  // "already signed in" redirect lives in the login page with a real DB check.
  return NextResponse.next();
}

export const config = {
  // Run on everything except API routes, Next internals and static assets.
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
