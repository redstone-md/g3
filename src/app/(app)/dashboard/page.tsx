"use client";

import { useTranslations } from "next-intl";
import { useAuth } from "@/components/auth/auth-context";
import { ForbiddenView } from "@/components/dashboard/forbidden-view";
import { PageHeader } from "@/components/dashboard/page-header";
import { StatsOverview } from "@/components/dashboard/stats-overview";

export default function DashboardPage() {
  const user = useAuth();
  const t = useTranslations("dashboard");

  if (!user.permissions.includes("dashboard.view")) return <ForbiddenView />;

  return (
    <>
      <PageHeader title={t("title")} description={t("description")} />
      <StatsOverview />
    </>
  );
}
