import {
  Activity01Icon,
  CloudIcon,
  DashboardSquare01Icon,
  DatabaseIcon,
  Key01Icon,
  type PaintBrushIcon,
  ShieldUserIcon,
  UserMultipleIcon,
} from "@hugeicons/core-free-icons";

/** Sidebar navigation, gated by permission. Client-safe (no server-only). */
export interface NavItem {
  /** Key under the `nav` message namespace. */
  titleKey:
    | "dashboard"
    | "roles"
    | "users"
    | "accounts"
    | "buckets"
    | "keys"
    | "audit";
  href: string;
  permission: string;
  icon: typeof PaintBrushIcon;
}

export interface NavGroup {
  /** Key under the `nav` message namespace for the group label. */
  labelKey: "workspace" | "access" | "storage" | "monitoring";
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    labelKey: "workspace",
    items: [
      {
        titleKey: "dashboard",
        href: "/dashboard",
        permission: "dashboard.view",
        icon: DashboardSquare01Icon,
      },
    ],
  },
  {
    labelKey: "access",
    items: [
      {
        titleKey: "users",
        href: "/dashboard/users",
        permission: "users.read",
        icon: UserMultipleIcon,
      },
      {
        titleKey: "roles",
        href: "/dashboard/roles",
        permission: "roles.read",
        icon: ShieldUserIcon,
      },
    ],
  },
  {
    labelKey: "storage",
    items: [
      {
        titleKey: "accounts",
        href: "/dashboard/accounts",
        permission: "accounts.read",
        icon: CloudIcon,
      },
      {
        titleKey: "buckets",
        href: "/dashboard/buckets",
        permission: "storage.read",
        icon: DatabaseIcon,
      },
      {
        titleKey: "keys",
        href: "/dashboard/keys",
        permission: "storage.read",
        icon: Key01Icon,
      },
    ],
  },
  {
    labelKey: "monitoring",
    items: [
      {
        titleKey: "audit",
        href: "/dashboard/audit",
        permission: "audit.read",
        icon: Activity01Icon,
      },
    ],
  },
];

/** Flat list (used by the command palette). */
export const NAV_ITEMS: NavItem[] = NAV_GROUPS.flatMap((g) => g.items);
