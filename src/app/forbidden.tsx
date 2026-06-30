import { ShieldUserIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";

export default async function Forbidden() {
  const t = await getTranslations("errors");
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-4 text-center">
      <div className="flex size-14 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <HugeiconsIcon icon={ShieldUserIcon} className="size-7" />
      </div>
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          {t("forbiddenTitle")}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t("forbiddenDescription")}
        </p>
      </div>
      <Button asChild variant="outline">
        <Link href="/dashboard">{t("back")}</Link>
      </Button>
    </main>
  );
}
