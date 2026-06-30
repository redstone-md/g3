"use client";

import { Tick02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { setMotion } from "@/lib/actions/motion";
import { setTheme } from "@/lib/actions/theme";
import { applyMotionClass, MOTION_PRESETS } from "@/lib/motion";
import { applyThemeClass, THEMES } from "@/lib/themes";
import { cn } from "@/lib/utils";

export function AppearanceSection({
  current,
  motion,
}: {
  current: string;
  motion: string;
}) {
  const t = useTranslations("settings");
  const router = useRouter();
  const [selected, setSelected] = useState(current);
  const [selectedMotion, setSelectedMotion] = useState(motion);
  const [, startTransition] = useTransition();

  function pick(slug: string) {
    if (slug === selected) return;
    setSelected(slug);
    applyThemeClass(slug);
    startTransition(async () => {
      await setTheme(slug);
      router.refresh();
    });
  }

  function pickMotion(preset: string) {
    if (preset === selectedMotion) return;
    setSelectedMotion(preset);
    applyMotionClass(preset);
    startTransition(async () => {
      await setMotion(preset);
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("appearance")}</CardTitle>
        <CardDescription>{t("appearanceDescription")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label>{t("theme")}</Label>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {THEMES.map((theme) => (
              <button
                key={theme.slug}
                type="button"
                onClick={() => pick(theme.slug)}
                className={cn(
                  "flex items-center justify-between rounded-lg border-2 px-3 py-2.5 text-sm transition",
                  theme.slug === selected
                    ? "border-primary bg-accent/40"
                    : "border-border/60 hover:bg-accent/30",
                )}
              >
                {theme.label}
                {theme.slug === selected ? (
                  <HugeiconsIcon
                    icon={Tick02Icon}
                    className="size-4 text-primary t-check-pop"
                  />
                ) : null}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label>{t("motion")}</Label>
          <p className="text-xs text-muted-foreground">
            {t("motionDescription")}
          </p>
          <div className="grid grid-cols-3 gap-3">
            {MOTION_PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => pickMotion(preset)}
                className={cn(
                  "flex items-center justify-center rounded-lg border-2 px-3 py-2.5 text-sm transition",
                  preset === selectedMotion
                    ? "border-primary bg-accent/40"
                    : "border-border/60 hover:bg-accent/30",
                )}
              >
                {t(`motion_${preset}`)}
              </button>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
