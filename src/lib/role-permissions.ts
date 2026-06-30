/** Role inheritance resolver — client-safe, cycle-protected. */

export interface RoleNode {
  id: string;
  permissions: string[];
  parentIds: string[];
}

/**
 * Transitive union of permissions for a set of starting role ids, following
 * `parentIds`. Cycle-safe (visited guard).
 */
export function effectivePermissions(
  startIds: string[],
  rolesById: Map<string, RoleNode>,
): string[] {
  const out = new Set<string>();
  const visited = new Set<string>();
  const stack = [...startIds];
  while (stack.length > 0) {
    const id = stack.pop() as string;
    if (visited.has(id)) continue;
    visited.add(id);
    const node = rolesById.get(id);
    if (!node) continue;
    for (const p of node.permissions) out.add(p);
    for (const parent of node.parentIds)
      if (!visited.has(parent)) stack.push(parent);
  }
  return [...out];
}

/** All ancestor role ids reachable from `startIds` (for cycle detection). */
export function ancestorIds(
  startIds: string[],
  rolesById: Map<string, RoleNode>,
): Set<string> {
  const visited = new Set<string>();
  const stack = [...startIds];
  while (stack.length > 0) {
    const id = stack.pop() as string;
    if (visited.has(id)) continue;
    visited.add(id);
    const node = rolesById.get(id);
    if (!node) continue;
    for (const parent of node.parentIds) stack.push(parent);
  }
  return visited;
}

export function toRoleMap(roles: RoleNode[]): Map<string, RoleNode> {
  return new Map(roles.map((r) => [r.id, r]));
}
