"use client";

import { Delete02Icon, PlusSignIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useTranslations } from "next-intl";
import { useState } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  type BalancingStrategy,
  useBalancing,
  useSetBalancing,
} from "@/hooks/use-balancing";
import { useBuckets, useCreateBucket, useDeleteBucket } from "@/hooks/use-buckets";
import type { BucketDTO } from "@/lib/types";

const dateFmt = new Intl.DateTimeFormat(undefined, { dateStyle: "medium" });
const STRATEGIES: BalancingStrategy[] = [
  "round_robin",
  "least_used",
  "fill_first",
  "hash",
];

export function BucketsView({ permissions }: { permissions: string[] }) {
  const t = useTranslations("buckets");
  const tc = useTranslations("common");
  const { data: buckets, isLoading, error } = useBuckets();
  const create = useCreateBucket();
  const remove = useDeleteBucket();
  const balancing = useBalancing();
  const setBalancing = useSetBalancing();

  const canWrite = permissions.includes("storage.write");
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [toDelete, setToDelete] = useState<BucketDTO | null>(null);

  async function submitCreate() {
    try {
      await create.mutateAsync(name.trim());
      setName("");
      setCreateOpen(false);
    } catch {
      /* toast shown by hook */
    }
  }

  return (
    <>
      <PageHeader title={t("title")} description={t("description")}>
        {canWrite ? (
          <Button onClick={() => setCreateOpen(true)}>
            <HugeiconsIcon icon={PlusSignIcon} />
            {t("new")}
          </Button>
        ) : null}
      </PageHeader>

      <Card className="mb-4">
        <CardHeader>
          <CardTitle>{t("balancing")}</CardTitle>
          <CardDescription>{t("balancingDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          <Select
            value={balancing.data?.strategy ?? "round_robin"}
            onValueChange={(v) => setBalancing.mutate(v as BalancingStrategy)}
            disabled={!canWrite || balancing.isLoading}
          >
            <SelectTrigger className="max-w-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STRATEGIES.map((s) => (
                <SelectItem key={s} value={s}>
                  {t(`strategy_${s}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
              <TableHead>{t("name")}</TableHead>
              <TableHead>{t("objects")}</TableHead>
              <TableHead className="hidden sm:table-cell">{t("created")}</TableHead>
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
              : buckets?.map((b) => (
                  <TableRow key={b.id} className="h-14">
                    <TableCell className="font-mono font-medium">{b.name}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {b.objectCount}
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground sm:table-cell">
                      {dateFmt.format(new Date(b.createdAt))}
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end">
                        {canWrite ? (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setToDelete(b)}
                            aria-label={t("delete")}
                          >
                            <HugeiconsIcon icon={Delete02Icon} />
                          </Button>
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
            {!isLoading && buckets?.length === 0 ? (
              <TableRow className="h-14">
                <TableCell colSpan={4} className="text-center text-muted-foreground">
                  {t("empty")}
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("new")}</DialogTitle>
            <DialogDescription>{t("nameHint")}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor="bucket-name">{t("name")}</Label>
            <Input
              id="bucket-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="my-bucket"
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              {tc("cancel")}
            </Button>
            <Button onClick={submitCreate} disabled={create.isPending}>
              <SwapText>{create.isPending ? tc("saving") : t("create")}</SwapText>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("deleteTitle")}</DialogTitle>
            <DialogDescription>
              <span className="font-mono font-medium">{toDelete?.name}</span>
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
              <SwapText>
                {remove.isPending ? tc("deleting") : tc("delete")}
              </SwapText>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
