"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { setNotificationsEnabled } from "@/lib/actions/profile";
import {
  notificationPermission,
  notify,
  requestNotificationPermission,
  setNativeNotificationsEnabled,
} from "@/lib/notify";

export function NotificationsSection({
  enabled: dEnabled,
}: {
  enabled: boolean;
}) {
  const t = useTranslations("settings");
  const [enabled, setEnabled] = useState(dEnabled);
  const [perm, setPerm] = useState("…");
  const [, startTransition] = useTransition();

  useEffect(() => setPerm(notificationPermission()), []);

  function toggle(value: boolean) {
    setEnabled(value);
    setNativeNotificationsEnabled(value);
    if (value) {
      void requestNotificationPermission().then(() =>
        setPerm(notificationPermission()),
      );
    }
    startTransition(async () => {
      await setNotificationsEnabled(value);
      toast.success(
        value ? t("notificationsEnabled") : t("notificationsDisabled"),
      );
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("notifications")}</CardTitle>
        <CardDescription>{t("notificationsDescription")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex items-center justify-between">
          <Label htmlFor="notif-toggle" className="flex flex-col gap-1">
            <span>{t("nativeNotifications")}</span>
            <span className="text-xs font-normal text-muted-foreground">
              {t("browserPermission", { perm })}
            </span>
          </Label>
          <Switch
            id="notif-toggle"
            checked={enabled}
            onCheckedChange={toggle}
          />
        </div>
        <Button
          variant="outline"
          onClick={() =>
            notify({
              variant: "info",
              title: t("testTitle"),
              description: t("testBody"),
            })
          }
        >
          {t("sendTest")}
        </Button>
      </CardContent>
    </Card>
  );
}
