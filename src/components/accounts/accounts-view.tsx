"use client";

import {
  Delete02Icon,
  PlusSignIcon,
  RefreshIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/dashboard/page-header";
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
  useAccounts,
  useDeleteAccount,
  useRefreshAccount,
} from "@/hooks/use-accounts";
import type { AccountDTO } from "@/lib/types";

function formatBytes(n: number): string {
  if (!n || n < 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB", "PB"];
  const i = Math.min(units.length - 1, Math.floor(Math.log(n) / Math.log(1024)));
  return `${(n / 1024 ** i).toFixed(i ? 1 : 0)} ${units[i]}`;
}

export function AccountsView({ permissions }: { permissions: string[] }) {
  const t = useTranslations("accounts");
  const tc = useTranslations("common");
  const { data: accounts, isLoading, error } = useAccounts();
  const refresh = useRefreshAccount();
  const remove = useDeleteAccount();
  const [toDelete, setToDelete] = useState<AccountDTO | null>(null);

  const can = {
    create: permissions.includes("accounts.create"),
    delete: permissions.includes("accounts.delete"),
  };

  // Surface the OAuth callback result (?connected / ?error) then clean the URL.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("connected")) toast.success(t("linked"));
    const err = params.get("error");
    if (err) toast.error(t("linkError", { reason: err }));
    if (params.has("connected") || params.has("error")) {
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [t]);

  async function confirmDelete() {
    if (!toDelete) return;
    try {
      await remove.mutateAsync(toDelete.id);
    } finally {
      setToDelete(null);
    }
  }

  return (
    <>
      <PageHeader title={t("title")} description={t("description")}>
        {can.create ? (
          <Button onClick={() => window.location.assign("/api/accounts/connect")}>
            <HugeiconsIcon icon={PlusSignIcon} />
            {t("add")}
          </Button>
        ) : null}
      </PageHeader>

      {error ? (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{(error as Error).message}</AlertDescription>
        </Alert>
      ) : null}

      <div className="overflow-hidden rounded-xl border border-border/60 bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("account")}</TableHead>
              <TableHead>{t("usage")}</TableHead>
              <TableHead className="hidden sm:table-cell">{t("weight")}</TableHead>
              <TableHead className="w-[1%]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading
              ? Array.from({ length: 3 }).map((_, i) => (
                  <TableRow key={i} className="h-16">
                    <TableCell colSpan={4}>
                      <Skeleton className="h-6 w-full" />
                    </TableCell>
                  </TableRow>
                ))
              : accounts?.map((acc) => (
                  <AccountRow
                    key={acc.id}
                    acc={acc}
                    canDelete={can.delete}
                    refreshing={refresh.isPending}
                    onRefresh={() => refresh.mutate(acc.id)}
                    onDelete={() => setToDelete(acc)}
                  />
                ))}
            {!isLoading && accounts?.length === 0 ? (
              <TableRow className="h-16">
                <TableCell
                  colSpan={4}
                  className="text-center text-muted-foreground"
                >
                  {t("empty")}
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("removeTitle")}</DialogTitle>
            <DialogDescription>
              <span className="font-medium">{toDelete?.email}</span> —{" "}
              {t("removeWarning")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setToDelete(null)}>
              {tc("cancel")}
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDelete}
              disabled={remove.isPending}
            >
              <SwapText>
                {remove.isPending ? tc("deleting") : t("remove")}
              </SwapText>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function AccountRow({
  acc,
  canDelete,
  refreshing,
  onRefresh,
  onDelete,
}: {
  acc: AccountDTO;
  canDelete: boolean;
  refreshing: boolean;
  onRefresh: () => void;
  onDelete: () => void;
}) {
  const t = useTranslations("accounts");
  const pct =
    acc.storageLimit > 0
      ? Math.min(100, Math.round((acc.storageUsage / acc.storageLimit) * 100))
      : 0;

  return (
    <TableRow className="h-16">
      <TableCell>
        <div className="flex flex-col">
          <span className="font-medium">{acc.email}</span>
          <Badge
            variant={acc.status === "connected" ? "outline" : "destructive"}
            className="mt-1 w-fit"
          >
            {acc.status === "connected" ? t("connected") : t("statusError")}
          </Badge>
        </div>
      </TableCell>
      <TableCell>
        <div className="min-w-40 max-w-64">
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className="mt-1 block text-xs text-muted-foreground">
            {formatBytes(acc.storageUsage)} /{" "}
            {acc.storageLimit > 0 ? formatBytes(acc.storageLimit) : t("unlimited")}
            {acc.storageLimit > 0 ? ` (${pct}%)` : ""}
          </span>
        </div>
      </TableCell>
      <TableCell className="hidden sm:table-cell">
        <Badge variant="secondary">{acc.weight}</Badge>
      </TableCell>
      <TableCell>
        <div className="flex justify-end gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={onRefresh}
            disabled={refreshing}
            aria-label={t("refresh")}
          >
            <HugeiconsIcon icon={RefreshIcon} />
          </Button>
          {canDelete ? (
            <Button
              variant="ghost"
              size="icon"
              onClick={onDelete}
              aria-label={t("remove")}
            >
              <HugeiconsIcon icon={Delete02Icon} />
            </Button>
          ) : null}
        </div>
      </TableCell>
    </TableRow>
  );
}
