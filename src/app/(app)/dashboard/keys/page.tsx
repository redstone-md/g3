"use client";

import { useAuth } from "@/components/auth/auth-context";
import { ForbiddenView } from "@/components/dashboard/forbidden-view";
import { KeysView } from "@/components/keys/keys-view";

export default function KeysPage() {
  const user = useAuth();
  if (!user.permissions.includes("storage.read")) return <ForbiddenView />;
  return <KeysView permissions={user.permissions} />;
}
