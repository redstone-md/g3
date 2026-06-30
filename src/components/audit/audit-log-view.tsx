"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { PageHeader } from "@/components/dashboard/page-header";
import { PaginationBar } from "@/components/dashboard/pagination-bar";
import { SearchInput } from "@/components/dashboard/search-input";
import { PAGE_SIZE, ROW_H, SpacerRow } from "@/components/dashboard/skeletons";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuditPage } from "@/hooks/use-audit";

const dateFmt = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
});

export function AuditLogView() {
  const t = useTranslations("audit");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const { data, isLoading } = useAuditPage({ q, page, pageSize: PAGE_SIZE });
  const rows = data?.items;

  return (
    <>
      <PageHeader title={t("title")} description={t("description")} />

      <div className="mb-4">
        <SearchInput
          value={q}
          onChange={(v) => {
            setQ(v);
            setPage(1);
          }}
          placeholder={t("searchPlaceholder")}
        />
      </div>

      <div className="overflow-hidden rounded-xl border border-border/60 bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("time")}</TableHead>
              <TableHead>{t("actor")}</TableHead>
              <TableHead>{t("action")}</TableHead>
              <TableHead className="hidden md:table-cell">
                {t("target")}
              </TableHead>
              <TableHead className="hidden lg:table-cell">{t("ip")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading
              ? Array.from({ length: PAGE_SIZE }).map((_, i) => (
                  <TableRow key={i} className={ROW_H}>
                    <TableCell colSpan={5}>
                      <Skeleton className="h-5 w-full" />
                    </TableCell>
                  </TableRow>
                ))
              : rows?.map((row) => (
                  <TableRow key={row.id} className={ROW_H}>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {dateFmt.format(new Date(row.createdAt))}
                    </TableCell>
                    <TableCell>{row.actorEmail ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant="outline" title={row.action}>
                        {t.has(`actions.${row.action}`)
                          ? t(`actions.${row.action}`)
                          : row.action}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground md:table-cell">
                      {row.targetType
                        ? `${row.targetType}:${row.targetId ?? ""}`
                        : "—"}
                    </TableCell>
                    <TableCell className="hidden font-mono text-xs text-muted-foreground lg:table-cell">
                      {row.ip ?? "—"}
                    </TableCell>
                  </TableRow>
                ))}
            {!isLoading && rows?.length === 0 ? (
              <TableRow className={ROW_H}>
                <TableCell
                  colSpan={5}
                  className="text-center text-muted-foreground"
                >
                  {t("empty")}
                </TableCell>
              </TableRow>
            ) : null}
            {!isLoading ? (
              <SpacerRow colSpan={5} count={rows?.length ? rows.length : 1} />
            ) : null}
          </TableBody>
        </Table>
        <PaginationBar
          page={page}
          pageSize={PAGE_SIZE}
          total={data?.total ?? 0}
          onPage={setPage}
        />
      </div>
    </>
  );
}
