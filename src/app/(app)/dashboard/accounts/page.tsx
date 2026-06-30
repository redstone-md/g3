"use client";

import { AccountsView } from "@/components/accounts/accounts-view";
import { useAuth } from "@/components/auth/auth-context";
import { ForbiddenView } from "@/components/dashboard/forbidden-view";

export default function AccountsPage() {
  const user = useAuth();
  if (!user.permissions.includes("accounts.read")) return <ForbiddenView />;
  return <AccountsView permissions={user.permissions} />;
}
