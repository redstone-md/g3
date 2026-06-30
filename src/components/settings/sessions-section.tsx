"use client";

import { ComputerIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useRevokeOtherSessions,
  useRevokeSession,
  useSessions,
} from "@/hooks/use-sessions";

const dateFmt = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
});

export function SessionsSection() {
  const t = useTranslations("settings");
  const { data: sessions, isLoading } = useSessions();
  const revoke = useRevokeSession();
  const revokeOthers = useRevokeOtherSessions();

  const hasOthers = (sessions ?? []).some((s) => !s.current);

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
        <div className="space-y-1.5">
          <CardTitle>{t("sessions")}</CardTitle>
          <CardDescription>{t("sessionsDescription")}</CardDescription>
        </div>
        {hasOthers ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => revokeOthers.mutate()}
            disabled={revokeOthers.isPending}
          >
            {t("revokeOthers")}
          </Button>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-2">
        {isLoading
          ? Array.from({ length: 2 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))
          : sessions?.map((s) => (
              <div
                key={s.id}
                className="flex items-center gap-3 rounded-lg border border-border/60 p-3"
              >
                <HugeiconsIcon
                  icon={ComputerIcon}
                  className="size-5 shrink-0 text-muted-foreground"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {s.userAgent || t("unknownDevice")}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {[s.ip, dateFmt.format(new Date(s.createdAt))]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
                {s.current ? (
                  <Badge variant="secondary">{t("thisDevice")}</Badge>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => revoke.mutate(s.id)}
                    disabled={revoke.isPending}
                  >
                    {t("revoke")}
                  </Button>
                )}
              </div>
            ))}
      </CardContent>
    </Card>
  );
}
