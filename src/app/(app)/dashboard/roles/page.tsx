import { RolesView } from "@/components/roles/roles-view";
import { requirePermission } from "@/lib/dal";

export default async function RolesPage() {
  const user = await requirePermission("roles.read");
  return <RolesView permissions={user.permissions} />;
}
