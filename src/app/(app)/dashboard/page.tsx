"use client";

import { useTranslations } from "next-intl";
import { useAuth } from "@/components/auth/auth-context";
import { ForbiddenView } from "@/components/dashboard/forbidden-view";
import { PageHeader } from "@/components/dashboard/page-header";
import { StatsOverview } from "@/components/dashboard/stats-overview";
import { StyleGuide } from "@/components/style-guide/style-guide";

export default function DashboardPage() {
  const user = useAuth();
  const t = useTranslations("styleGuide");

  if (!user.permissions.includes("styleguide.view")) return <ForbiddenView />;

  return (
    <>
      <PageHeader title={t("title")} description={t("description")} />
      {user.permissions.includes("storage.read") ? <StatsOverview /> : null}
      <StyleGuide />
    </>
  );
}
