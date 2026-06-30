"use client";

import { Search01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { useCommandStore } from "@/stores/use-command-store";

export function CommandTrigger() {
  const t = useTranslations("header");
  const toggle = useCommandStore((s) => s.toggle);
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={toggle}
      className="gap-2 text-muted-foreground"
    >
      <HugeiconsIcon icon={Search01Icon} className="size-4" />
      <span className="hidden sm:inline">{t("search")}</span>
      <kbd className="hidden rounded border border-border bg-muted px-1.5 font-mono text-[10px] sm:inline">
        ⌘K
      </kbd>
    </Button>
  );
}
