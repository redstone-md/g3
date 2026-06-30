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
import {
  OAuthClientEditor,
  OAuthCredentialsDialog,
} from "@/components/oauth/oauth-client-editor";
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
import {
  useDeleteOAuthClient,
  useOAuthClientsPage,
} from "@/hooks/use-oauth-clients";
import type { OAuthClientDTO } from "@/lib/types";
import { useOAuthDialogStore } from "@/stores/use-oauth-dialog-store";

export function OAuthClientsView({ permissions }: { permissions: string[] }) {
  const t = useTranslations("oauth");
  const tc = useTranslations("common");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState("createdAt");
  const [order, setOrder] = useState<"asc" | "desc">("desc");

  const { data, isLoading } = useOAuthClientsPage({
    q,
    page,
    pageSize: PAGE_SIZE,
    sort,
    order,
  });
  const openCreate = useOAuthDialogStore((s) => s.openCreate);
  const openEdit = useOAuthDialogStore((s) => s.openEdit);
  const deleteClient = useDeleteOAuthClient();
  const [toDelete, setToDelete] = useState<OAuthClientDTO | null>(null);

  const can = {
    create: permissions.includes("oauth.create"),
    update: permissions.includes("oauth.update"),
    delete: permissions.includes("oauth.delete"),
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
      await deleteClient.mutateAsync(toDelete.id);
    } finally {
      setToDelete(null);
    }
  }

  const clients = data?.items;

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
                {t("clientId")}
              </TableHead>
              <TableHead>{t("type")}</TableHead>
              <TableHead className="hidden lg:table-cell">
                {t("redirectUris")}
              </TableHead>
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
              : clients?.map((client) => (
                  <TableRow key={client.id} className={ROW_H}>
                    <TableCell className="font-medium">{client.name}</TableCell>
                    <TableCell className="hidden font-mono text-xs text-muted-foreground md:table-cell">
                      {client.clientId}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={client.isPublic ? "outline" : "secondary"}
                      >
                        {client.isPublic ? t("public") : t("confidential")}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground lg:table-cell">
                      {client.redirectUris.length}
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        {can.update ? (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEdit(client)}
                            aria-label={t("editAria")}
                          >
                            <HugeiconsIcon icon={Edit02Icon} />
                          </Button>
                        ) : null}
                        {can.delete ? (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setToDelete(client)}
                            aria-label={t("deleteAria")}
                          >
                            <HugeiconsIcon icon={Delete02Icon} />
                          </Button>
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
            {!isLoading && clients?.length === 0 ? (
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
              <SpacerRow
                colSpan={5}
                count={clients?.length ? clients.length : 1}
              />
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

      <OAuthClientEditor />
      <OAuthCredentialsDialog />

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
              disabled={deleteClient.isPending}
            >
              <SwapText>
                {deleteClient.isPending ? tc("deleting") : tc("delete")}
              </SwapText>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
