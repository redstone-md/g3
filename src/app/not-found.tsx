import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";

export default async function NotFound() {
  const t = await getTranslations("errors");
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-4 text-center">
      <p className="text-5xl font-bold tracking-tight text-muted-foreground">
        404
      </p>
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          {t("notFoundTitle")}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t("notFoundDescription")}
        </p>
      </div>
      <Button asChild variant="outline">
        <Link href="/dashboard">{t("back")}</Link>
      </Button>
    </main>
  );
}
