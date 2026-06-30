import "server-only";
import { prisma } from "@/lib/db";
import { effectivePermissions, toRoleMap } from "@/lib/role-permissions";

/**
 * Lockout protection. The sentinel capability is `roles.update`: whoever can
 * edit roles can grant themselves anything, so the system must never drop to
 * zero users holding it. Inheritance-aware — a role is "admin" if its effective
 * (own + inherited) permissions include the sentinel.
 */
export const ADMIN_PERMISSION = "roles.update";

export function grantsAdmin(permissions: string[] | undefined | null): boolean {
  return permissions?.includes(ADMIN_PERMISSION) ?? false;
}

async function loadRoleGraph() {
  const roles = await prisma.role.findMany({
    select: { id: true, permissions: true, parentIds: true },
  });
  return toRoleMap(roles);
}

/** Role ids whose effective permissions grant the admin sentinel. */
async function adminRoleIds(): Promise<string[]> {
  const map = await loadRoleGraph();
  const ids: string[] = [];
  for (const id of map.keys()) {
    if (effectivePermissions([id], map).includes(ADMIN_PERMISSION))
      ids.push(id);
  }
  return ids;
}

/** Do the given role ids together grant admin (incl. inheritance)? */
export async function roleIdsGrantAdmin(roleIds: string[]): Promise<boolean> {
  if (roleIds.length === 0) return false;
  const map = await loadRoleGraph();
  return effectivePermissions(roleIds, map).includes(ADMIN_PERMISSION);
}

/** Count of users who currently hold the admin capability (via any role). */
export async function adminUserCount(): Promise<number> {
  const ids = await adminRoleIds();
  if (ids.length === 0) return 0;
  return prisma.user.count({ where: { roleIds: { hasSome: ids } } });
}

/** Admins that would remain if `roleId` stopped granting the sentinel. */
export async function adminUserCountExcludingRole(
  roleId: string,
): Promise<number> {
  const ids = (await adminRoleIds()).filter((id) => id !== roleId);
  if (ids.length === 0) return 0;
  return prisma.user.count({ where: { roleIds: { hasSome: ids } } });
}
