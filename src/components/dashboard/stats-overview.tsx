"use client";

import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useStats } from "@/hooks/use-stats";

function formatBytes(n: number): string {
  if (!n || n < 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB", "PB"];
  const i = Math.min(units.length - 1, Math.floor(Math.log(n) / Math.log(1024)));
  return `${(n / 1024 ** i).toFixed(i ? 1 : 0)} ${units[i]}`;
}

/** At-a-glance G3 metrics for the dashboard landing. */
export function StatsOverview() {
  const t = useTranslations("dashboard");
  const { data, isLoading } = useStats();

  const pct =
    data && data.poolLimit > 0
      ? Math.min(100, Math.round((data.poolUsage / data.poolLimit) * 100))
      : 0;

  const cards = [
    { label: t("buckets"), value: data ? String(data.buckets) : "—" },
    { label: t("objects"), value: data ? String(data.objects) : "—" },
    { label: t("stored"), value: data ? formatBytes(data.totalSize) : "—" },
    {
      label: t("accounts"),
      value: data ? `${data.connectedAccounts}/${data.accounts}` : "—",
    },
  ];

  return (
    <div className="mb-6 space-y-4">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {cards.map((c) => (
          <Card key={c.label}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {c.label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <span className="text-2xl font-semibold tabular-nums">
                  {c.value}
                </span>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {t("poolUsage")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading || !data ? (
            <Skeleton className="h-2 w-full" />
          ) : (
            <>
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-[width] duration-500"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="mt-2 block text-xs text-muted-foreground">
                {formatBytes(data.poolUsage)} {t("of")}{" "}
                {data.poolLimit > 0 ? formatBytes(data.poolLimit) : "∞"}
                {data.poolLimit > 0 ? ` (${pct}%)` : ""}
              </span>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
