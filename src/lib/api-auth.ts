import "server-only";
import { NextResponse } from "next/server";
import { type CurrentUser, getCurrentUser, hasPermission } from "@/lib/dal";

type AuthResult =
  | { user: CurrentUser; error: null }
  | { user: null; error: NextResponse };

/**
 * Route-handler guard. Returns a 401/403 `NextResponse` to return early, or the
 * authenticated user when the permission is granted.
 */
export async function authorize(permission: string): Promise<AuthResult> {
  const user = await getCurrentUser();
  if (!user) {
    return {
      user: null,
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
  if (!hasPermission(user, permission)) {
    return {
      user: null,
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }
  return { user, error: null };
}
