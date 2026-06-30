"use client";

import { ArrowLeft01Icon, ArrowRight01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

interface PaginationBarProps {
  page: number;
  pageSize: number;
  total: number;
  onPage: (page: number) => void;
}

export function PaginationBar({
  page,
  pageSize,
  total,
  onPage,
}: PaginationBarProps) {
  const t = useTranslations("common");
  const pages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="flex items-center justify-between border-t border-border/60 px-4 py-3 text-sm">
      <span className="text-muted-foreground">
        {t("results", { count: total })}
      </span>
      <div className="flex items-center gap-3">
        <span className="text-muted-foreground">
          {t("pageOf", { page, pages })}
        </span>
        <div className="flex gap-1">
          <Button
            variant="outline"
            size="icon"
            disabled={page <= 1}
            onClick={() => onPage(page - 1)}
            aria-label={t("previousPage")}
          >
            <HugeiconsIcon icon={ArrowLeft01Icon} />
          </Button>
          <Button
            variant="outline"
            size="icon"
            disabled={page >= pages}
            onClick={() => onPage(page + 1)}
            aria-label={t("nextPage")}
          >
            <HugeiconsIcon icon={ArrowRight01Icon} />
          </Button>
        </div>
      </div>
    </div>
  );
}
