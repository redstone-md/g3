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
import { setLocale } from "@/lib/actions/locale";
import { LOCALE_LABELS, LOCALES, type Locale } from "@/lib/locales";
import { cn } from "@/lib/utils";

export function LanguageSection({ current }: { current: string }) {
  const t = useTranslations("settings");
  const router = useRouter();
  const [selected, setSelected] = useState(current);
  const [, startTransition] = useTransition();

  function pick(locale: Locale) {
    if (locale === selected) return;
    setSelected(locale);
    startTransition(async () => {
      await setLocale(locale);
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("language")}</CardTitle>
        <CardDescription>{t("languageDescription")}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid max-w-sm gap-3 sm:grid-cols-2">
          {LOCALES.map((locale) => (
            <button
              key={locale}
              type="button"
              onClick={() => pick(locale)}
              className={cn(
                "flex items-center justify-between rounded-lg border-2 px-3 py-2.5 text-sm transition",
                locale === selected
                  ? "border-primary bg-accent/40"
                  : "border-border/60 hover:bg-accent/30",
              )}
            >
              {LOCALE_LABELS[locale]}
              {locale === selected ? (
                <HugeiconsIcon
                  icon={Tick02Icon}
                  className="size-4 text-primary t-check-pop"
                />
              ) : null}
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
