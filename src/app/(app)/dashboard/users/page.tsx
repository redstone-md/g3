import { UsersView } from "@/components/users/users-view";
import { requirePermission } from "@/lib/dal";

export default async function UsersPage() {
  const user = await requirePermission("users.read");
  return <UsersView permissions={user.permissions} currentUserId={user.id} />;
}
