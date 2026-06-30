import { AuditLogView } from "@/components/audit/audit-log-view";
import { requirePermission } from "@/lib/dal";

export default async function AuditPage() {
  await requirePermission("audit.read");
  return <AuditLogView />;
}
