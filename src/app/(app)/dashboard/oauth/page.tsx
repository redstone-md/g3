import { OAuthClientsView } from "@/components/oauth/oauth-clients-view";
import { requirePermission } from "@/lib/dal";

export default async function OAuthClientsPage() {
  const user = await requirePermission("oauth.read");
  return <OAuthClientsView permissions={user.permissions} />;
}
