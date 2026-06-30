"use client";

import { useAuth } from "@/components/auth/auth-context";
import { ForbiddenView } from "@/components/dashboard/forbidden-view";
import { UsersView } from "@/components/users/users-view";

export default function UsersPage() {
  const user = useAuth();
  if (!user.permissions.includes("users.read")) return <ForbiddenView />;
  return <UsersView permissions={user.permissions} currentUserId={user.id} />;
}
