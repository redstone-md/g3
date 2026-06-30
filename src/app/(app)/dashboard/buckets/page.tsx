"use client";

import { useAuth } from "@/components/auth/auth-context";
import { BucketsView } from "@/components/buckets/buckets-view";
import { ForbiddenView } from "@/components/dashboard/forbidden-view";

export default function BucketsPage() {
  const user = useAuth();
  if (!user.permissions.includes("storage.read")) return <ForbiddenView />;
  return <BucketsView permissions={user.permissions} />;
}
