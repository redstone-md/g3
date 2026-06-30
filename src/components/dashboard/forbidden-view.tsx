"use client";

import { useTranslations } from "next-intl";

/** Shown in place of a page's content when the user lacks its permission. */
export function ForbiddenView() {
  const t = useTranslations("errors");
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-2 text-center">
      <p className="text-4xl font-semibold tracking-tight">403</p>
      <p className="text-muted-foreground">{t("forbiddenDescription")}</p>
    </div>
  );
}
