"use client";

import {
  Delete02Icon,
  Edit02Icon,
  PlusSignIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { PageHeader } from "@/components/dashboard/page-header";
import { PaginationBar } from "@/components/dashboard/pagination-bar";
import { SearchInput } from "@/components/dashboard/search-input";
import { PAGE_SIZE, ROW_H, SpacerRow } from "@/components/dashboard/skeletons";
import { SortHeader } from "@/components/dashboard/sort-header";
import { RoleEditor } from "@/components/roles/role-editor";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PopNumber } from "@/components/ui/pop-number";
import { Skeleton } from "@/components/ui/skeleton";
import { SwapText } from "@/components/ui/swap-text";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useDeleteRole, useRolesPage } from "@/hooks/use-roles";
import type { RoleDTO } from "@/lib/types";
import { useRoleDialogStore } from "@/stores/use-role-dialog-store";

export function RolesView({ permissions }: { permissions: string[] }) {
  const t = useTranslations("roles");
  const tc = useTranslations("common");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState("name");
  const [order, setOrder] = useState<"asc" | "desc">("asc");

  const { data, isLoading, error } = useRolesPage({
    q,
    page,
    pageSize: PAGE_SIZE,
    sort,
    order,
  });
  const openCreate = useRoleDialogStore((s) => s.openCreate);
  const openEdit = useRoleDialogStore((s) => s.openEdit);
  const deleteRole = useDeleteRole();
  const [toDelete, setToDelete] = useState<RoleDTO | null>(null);

  const can = {
    create: permissions.includes("roles.create"),
    update: permissions.includes("roles.update"),
    delete: permissions.includes("roles.delete"),
  };

  function toggleSort(field: string) {
    if (sort === field) setOrder((o) => (o === "asc" ? "desc" : "asc"));
    else {
      setSort(field);
      setOrder("asc");
    }
    setPage(1);
  }

  async function confirmDelete() {
    if (!toDelete) return;
    try {
      await deleteRole.mutateAsync(toDelete.id);
    } finally {
      setToDelete(null);
    }
  }

  const roles = data?.items;

  return (
    <>
      <PageHeader title={t("title")} description={t("description")}>
        {can.create ? (
          <Button onClick={openCreate}>
            <HugeiconsIcon icon={PlusSignIcon} />
            {t("new")}
          </Button>
        ) : null}
      </PageHeader>

      {error ? (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{(error as Error).message}</AlertDescription>
        </Alert>
      ) : null}

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
              <TableHead>
                <SortHeader
                  label={t("name")}
                  field="name"
                  sort={sort}
                  order={order}
                  onSort={toggleSort}
                />
              </TableHead>
              <TableHead className="hidden md:table-cell">
                {t("descriptionCol")}
              </TableHead>
              <TableHead>{t("permissions")}</TableHead>
              <TableHead>{t("members")}</TableHead>
              <TableHead className="w-[1%]" />
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
              : roles?.map((role) => (
                  <TableRow key={role.id} className={ROW_H}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {role.name}
                        {role.isSystem ? (
                          <Badge variant="secondary" className="text-[10px]">
                            {t("system")}
                          </Badge>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell className="hidden max-w-xs truncate text-muted-foreground md:table-cell">
                      {role.description ?? "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        <PopNumber value={role.permissions.length} />
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      <PopNumber value={role.userCount} />
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        {can.update ? (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEdit(role)}
                            aria-label={t("editAria")}
                          >
                            <HugeiconsIcon icon={Edit02Icon} />
                          </Button>
                        ) : null}
                        {can.delete && !role.isSystem ? (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setToDelete(role)}
                            aria-label={t("deleteAria")}
                          >
                            <HugeiconsIcon icon={Delete02Icon} />
                          </Button>
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
            {!isLoading && roles?.length === 0 ? (
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
              <SpacerRow colSpan={5} count={roles?.length ? roles.length : 1} />
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

      <RoleEditor />

      <Dialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("deleteTitle")}</DialogTitle>
            <DialogDescription>
              <span className="font-medium">{toDelete?.name}</span>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setToDelete(null)}>
              {tc("cancel")}
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDelete}
              disabled={deleteRole.isPending}
            >
              <SwapText>
                {deleteRole.isPending ? tc("deleting") : tc("delete")}
              </SwapText>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
