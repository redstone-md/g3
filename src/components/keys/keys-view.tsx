"use client";

import { Delete02Icon, PlusSignIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/dashboard/page-header";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CopyButton } from "@/components/ui/copy-button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAccessKeys, useCreateKey, useDeleteKey } from "@/hooks/use-keys";
import type { AccessKeyDTO, CreatedKeyDTO } from "@/lib/types";

const dateFmt = new Intl.DateTimeFormat(undefined, { dateStyle: "medium" });

export function KeysView({ permissions }: { permissions: string[] }) {
  const t = useTranslations("keys");
  const tc = useTranslations("common");
  const { data: keys, isLoading, error } = useAccessKeys();
  const create = useCreateKey();
  const remove = useDeleteKey();

  const canWrite = permissions.includes("storage.write");
  const [created, setCreated] = useState<CreatedKeyDTO | null>(null);
  const [toDelete, setToDelete] = useState<AccessKeyDTO | null>(null);
  const [endpoint, setEndpoint] = useState("");

  useEffect(() => {
    setEndpoint(`http://${window.location.hostname}:9000`);
  }, []);

  async function submitCreate() {
    try {
      setCreated(await create.mutateAsync(""));
    } catch {
      /* toast shown by hook */
    }
  }

  return (
    <>
      <PageHeader title={t("title")} description={t("description")}>
        {canWrite ? (
          <Button onClick={submitCreate} disabled={create.isPending}>
            <HugeiconsIcon icon={PlusSignIcon} />
            {t("new")}
          </Button>
        ) : null}
      </PageHeader>

      <Card className="mb-4">
        <CardHeader>
          <CardTitle>{t("endpoint")}</CardTitle>
          <CardDescription>{t("endpointDescription")}</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center gap-2">
          <code className="rounded bg-muted px-2 py-1 text-sm">{endpoint}</code>
          <CopyButton value={endpoint} label={t("endpoint")} />
          <span className="text-xs text-muted-foreground">
            {t("pathStyle")}
          </span>
        </CardContent>
      </Card>

      {error ? (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{(error as Error).message}</AlertDescription>
        </Alert>
      ) : null}

      <div className="overflow-hidden rounded-xl border border-border/60 bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("accessKeyId")}</TableHead>
              <TableHead className="hidden sm:table-cell">
                {t("label")}
              </TableHead>
              <TableHead className="hidden lg:table-cell">
                {t("lastUsed")}
              </TableHead>
              <TableHead className="w-[1%]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading
              ? Array.from({ length: 3 }).map((_, i) => (
                  <TableRow key={i} className="h-14">
                    <TableCell colSpan={4}>
                      <Skeleton className="h-5 w-full" />
                    </TableCell>
                  </TableRow>
                ))
              : keys?.map((k) => (
                  <TableRow key={k.id} className="h-14">
                    <TableCell className="font-mono">{k.accessKeyId}</TableCell>
                    <TableCell className="hidden text-muted-foreground sm:table-cell">
                      {k.label || "—"}
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground lg:table-cell">
                      {k.lastUsedAt
                        ? dateFmt.format(new Date(k.lastUsedAt))
                        : t("never")}
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end">
                        {canWrite ? (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setToDelete(k)}
                            aria-label={t("revoke")}
                          >
                            <HugeiconsIcon icon={Delete02Icon} />
                          </Button>
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
            {!isLoading && keys?.length === 0 ? (
              <TableRow className="h-14">
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

      {/* One-time secret reveal */}
      <Dialog open={!!created} onOpenChange={(o) => !o && setCreated(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("createdTitle")}</DialogTitle>
            <DialogDescription>{t("createdWarning")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Field
              label={t("accessKeyId")}
              value={created?.accessKeyId ?? ""}
            />
            <Field
              label={t("secretAccessKey")}
              value={created?.secretAccessKey ?? ""}
            />
          </div>
          <DialogFooter>
            <Button onClick={() => setCreated(null)}>{tc("done")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("revokeTitle")}</DialogTitle>
            <DialogDescription>
              <span className="font-mono">{toDelete?.accessKeyId}</span> —{" "}
              {t("revokeWarning")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setToDelete(null)}>
              {tc("cancel")}
            </Button>
            <Button
              variant="destructive"
              disabled={remove.isPending}
              onClick={async () => {
                if (!toDelete) return;
                try {
                  await remove.mutateAsync(toDelete.id);
                } finally {
                  setToDelete(null);
                }
              }}
            >
              {t("revoke")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1">
      <Label>{label}</Label>
      <div className="flex items-center gap-2">
        <Input value={value} readOnly className="font-mono text-xs" />
        <CopyButton value={value} label={label} />
      </div>
    </div>
  );
}
