import "server-only";
import { forbidden, redirect } from "next/navigation";
import { cache } from "react";
import { prisma } from "@/lib/db";
import { effectivePermissions, toRoleMap } from "@/lib/role-permissions";
import { getSessionRecord } from "@/lib/session";

export interface RoleSummary {
  id: string;
  name: string;
  isSystem: boolean;
  permissions: string[];
}

/** Minimal, client-safe shape of the authenticated user. No password hash. */
export interface CurrentUser {
  id: string;
  email: string;
  name: string | null;
  mustChangePassword: boolean;
  theme: string;
  motion: string;
  locale: string;
  avatar: string | null;
  notificationsEnabled: boolean;
  roles: RoleSummary[];
  /** Effective permissions = union of every assigned role's permissions. */
  permissions: string[];
}

/**
 * Secure, DB-backed session check. Memoized per render pass via React `cache`
 * so layout + page + leaf components share one query. Returns null when
 * unauthenticated — callers decide whether to redirect.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const session = await getSessionRecord();
  if (!session) return null;

  const { user } = session;
  const roles: RoleSummary[] = user.roles.map((r) => ({
    id: r.id,
    name: r.name,
    isSystem: r.isSystem,
    permissions: r.permissions,
  }));

  // Effective permissions include everything inherited via parentIds.
  const allRoles = await prisma.role.findMany({
    select: { id: true, permissions: true, parentIds: true },
  });
  const permissions = effectivePermissions(
    user.roles.map((r) => r.id),
    toRoleMap(allRoles),
  );

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    mustChangePassword: user.mustChangePassword,
    theme: user.theme,
    motion: user.motion,
    locale: user.locale,
    avatar: user.avatar,
    notificationsEnabled: user.notificationsEnabled,
    roles,
    permissions,
  };
});

/** True when the user's combined roles grant the given permission key. */
export function hasPermission(
  user: CurrentUser | null,
  permission: string,
): boolean {
  return user?.permissions.includes(permission) ?? false;
}

/** Require an authenticated user or bounce to /login. */
export async function verifySession(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/** Require both authentication and a specific permission. 403s otherwise. */
export async function requirePermission(
  permission: string,
): Promise<CurrentUser> {
  const user = await verifySession();
  if (!hasPermission(user, permission)) forbidden();
  return user;
}
