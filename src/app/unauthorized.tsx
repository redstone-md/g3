import { LockPasswordIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";

export default async function Unauthorized() {
  const t = await getTranslations("errors");
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-4 text-center">
      <div className="flex size-14 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <HugeiconsIcon icon={LockPasswordIcon} className="size-7" />
      </div>
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          {t("unauthorizedTitle")}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t("unauthorizedDescription")}
        </p>
      </div>
      <Button asChild>
        <Link href="/login">{t("signIn")}</Link>
      </Button>
    </main>
  );
}
