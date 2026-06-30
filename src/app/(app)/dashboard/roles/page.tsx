"use client";

import { useAuth } from "@/components/auth/auth-context";
import { ForbiddenView } from "@/components/dashboard/forbidden-view";
import { RolesView } from "@/components/roles/roles-view";

export default function RolesPage() {
  const user = useAuth();
  if (!user.permissions.includes("roles.read")) return <ForbiddenView />;
  return <RolesView permissions={user.permissions} />;
}
