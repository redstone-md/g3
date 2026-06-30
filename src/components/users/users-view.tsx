"use client";

import {
  Delete02Icon,
  Edit02Icon,
  PlusSignIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { PresetAvatar } from "@/components/avatar/preset-avatar";
import { PageHeader } from "@/components/dashboard/page-header";
import { PaginationBar } from "@/components/dashboard/pagination-bar";
import { SearchInput } from "@/components/dashboard/search-input";
import { PAGE_SIZE, ROW_H, SpacerRow } from "@/components/dashboard/skeletons";
import { SortHeader } from "@/components/dashboard/sort-header";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
import { UserEditor } from "@/components/users/user-editor";
import { useDeleteUser, useUsersPage } from "@/hooks/use-users";
import { isValidAvatar } from "@/lib/avatars";
import type { UserDTO } from "@/lib/types";
import { useUserDialogStore } from "@/stores/use-user-dialog-store";

const dateFmt = new Intl.DateTimeFormat(undefined, { dateStyle: "medium" });

interface UsersViewProps {
  permissions: string[];
  currentUserId: string;
}

export function UsersView({ permissions, currentUserId }: UsersViewProps) {
  const t = useTranslations("users");
  const tc = useTranslations("common");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState("createdAt");
  const [order, setOrder] = useState<"asc" | "desc">("desc");

  const { data, isLoading, error } = useUsersPage({
    q,
    page,
    pageSize: PAGE_SIZE,
    sort,
    order,
  });
  const openCreate = useUserDialogStore((s) => s.openCreate);
  const openEdit = useUserDialogStore((s) => s.openEdit);
  const deleteUser = useDeleteUser();
  const [toDelete, setToDelete] = useState<UserDTO | null>(null);

  const can = {
    create: permissions.includes("users.create"),
    update: permissions.includes("users.update"),
    delete: permissions.includes("users.delete"),
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
      await deleteUser.mutateAsync(toDelete.id);
    } finally {
      setToDelete(null);
    }
  }

  const users = data?.items;

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
                  label={t("user")}
                  field="email"
                  sort={sort}
                  order={order}
                  onSort={toggleSort}
                />
              </TableHead>
              <TableHead>{t("roles")}</TableHead>
              <TableHead className="hidden sm:table-cell">
                {t("status")}
              </TableHead>
              <TableHead className="hidden lg:table-cell">
                <SortHeader
                  label={t("created")}
                  field="createdAt"
                  sort={sort}
                  order={order}
                  onSort={toggleSort}
                />
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
              : users?.map((user) => (
                  <TableRow key={user.id} className={ROW_H}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="size-8">
                          {isValidAvatar(user.avatar) ? (
                            <PresetAvatar avatarKey={user.avatar} />
                          ) : (
                            <AvatarFallback className="bg-primary/15 text-xs font-medium text-primary">
                              {(user.name || user.email)
                                .slice(0, 2)
                                .toUpperCase()}
                            </AvatarFallback>
                          )}
                        </Avatar>
                        <div className="flex flex-col">
                          <span className="font-medium">
                            {user.name || "—"}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {user.email}
                          </span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {user.roles.length ? (
                        <div className="flex flex-wrap gap-1">
                          {user.roles.map((r) => (
                            <Badge key={r.id} variant="secondary">
                              {r.name}
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <Badge variant="outline">
                        {user.mustChangePassword ? t("pending") : t("active")}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground lg:table-cell">
                      {dateFmt.format(new Date(user.createdAt))}
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        {can.update ? (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEdit(user)}
                            aria-label={t("editAria")}
                          >
                            <HugeiconsIcon icon={Edit02Icon} />
                          </Button>
                        ) : null}
                        {can.delete && user.id !== currentUserId ? (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setToDelete(user)}
                            aria-label={t("deleteAria")}
                          >
                            <HugeiconsIcon icon={Delete02Icon} />
                          </Button>
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
            {!isLoading && users?.length === 0 ? (
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
              <SpacerRow colSpan={5} count={users?.length ? users.length : 1} />
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

      <UserEditor />

      <Dialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("deleteTitle")}</DialogTitle>
            <DialogDescription>
              <span className="font-medium">{toDelete?.email}</span>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setToDelete(null)}>
              {tc("cancel")}
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDelete}
              disabled={deleteUser.isPending}
            >
              <SwapText>
                {deleteUser.isPending ? tc("deleting") : tc("delete")}
              </SwapText>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
