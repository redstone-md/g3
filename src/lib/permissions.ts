/**
 * Authoritative permission catalog.
 *
 * This is the single source of truth for every permission key in the system.
 * It is intentionally framework-agnostic (no `server-only`) so the role editor
 * UI can render the same catalog the server enforces.
 *
 * Roles store a subset of these keys; a user inherits their role's keys.
 */

export interface PermissionDef {
  key: string;
  label: string;
  description: string;
}

export interface PermissionGroup {
  key: string;
  label: string;
  permissions: PermissionDef[];
}

export const PERMISSION_GROUPS: readonly PermissionGroup[] = [
  {
    key: "styleguide",
    label: "Style Guide",
    permissions: [
      {
        key: "styleguide.view",
        label: "View Style Guide",
        description: "Access the design system reference page.",
      },
    ],
  },
  {
    key: "users",
    label: "Users",
    permissions: [
      {
        key: "users.read",
        label: "View users",
        description: "List and inspect user accounts.",
      },
      {
        key: "users.create",
        label: "Create users",
        description: "Invite or create new accounts.",
      },
      {
        key: "users.update",
        label: "Edit users",
        description: "Change profile and role assignment.",
      },
      {
        key: "users.delete",
        label: "Delete users",
        description: "Permanently remove accounts.",
      },
    ],
  },
  {
    key: "roles",
    label: "Roles",
    permissions: [
      {
        key: "roles.read",
        label: "View roles",
        description: "List roles and their permissions.",
      },
      {
        key: "roles.create",
        label: "Create roles",
        description: "Define new custom roles.",
      },
      {
        key: "roles.update",
        label: "Edit roles",
        description: "Rename roles and adjust permissions.",
      },
      {
        key: "roles.delete",
        label: "Delete roles",
        description: "Remove non-system roles.",
      },
    ],
  },
  {
    key: "audit",
    label: "Audit Log",
    permissions: [
      {
        key: "audit.read",
        label: "View audit log",
        description: "Read the system activity log.",
      },
    ],
  },
] as const;

/** Every valid permission key, flattened. */
export const ALL_PERMISSIONS: string[] = PERMISSION_GROUPS.flatMap((group) =>
  group.permissions.map((permission) => permission.key),
);

const PERMISSION_KEY_SET = new Set(ALL_PERMISSIONS);

/** Type guard — narrows an arbitrary string to a known permission key. */
export function isPermissionKey(value: string): boolean {
  return PERMISSION_KEY_SET.has(value);
}

/** Drop any unknown keys so a bad payload can never grant a phantom permission. */
export function sanitizePermissions(keys: string[]): string[] {
  return [...new Set(keys)].filter(isPermissionKey);
}
