"use client";

import { AuditLogView } from "@/components/audit/audit-log-view";
import { useAuth } from "@/components/auth/auth-context";
import { ForbiddenView } from "@/components/dashboard/forbidden-view";

export default function AuditPage() {
  const user = useAuth();
  if (!user.permissions.includes("audit.read")) return <ForbiddenView />;
  return <AuditLogView />;
}
