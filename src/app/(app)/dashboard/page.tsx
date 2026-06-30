import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/dashboard/page-header";
import { StyleGuide } from "@/components/style-guide/style-guide";
import { requirePermission } from "@/lib/dal";

export default async function DashboardPage() {
  await requirePermission("styleguide.view");
  const t = await getTranslations("styleGuide");

  return (
    <>
      <PageHeader title={t("title")} description={t("description")} />
      <StyleGuide />
    </>
  );
}
