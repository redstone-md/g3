"use client";

import {
  ArrowLeft01Icon,
  Delete02Icon,
  Download01Icon,
  Folder01Icon,
  File01Icon,
  Upload01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useRef, useState } from "react";
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
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  type ObjectEntry,
  objectDownloadUrl,
  useBucketPolicy,
  useDeleteObject,
  useObjects,
  useSetBucketPolicy,
  useUploadObject,
} from "@/hooks/use-objects";

const dateFmt = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
});

function formatBytes(n: number): string {
  if (!n || n < 0) return "0 B";
  const u = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(u.length - 1, Math.floor(Math.log(n) / Math.log(1024)));
  return `${(n / 1024 ** i).toFixed(i ? 1 : 0)} ${u[i]}`;
}

export function ObjectsView({
  bucketId,
  permissions,
}: {
  bucketId: string;
  permissions: string[];
}) {
  const t = useTranslations("objects");
  const tc = useTranslations("common");
  const router = useRouter();
  const [prefix, setPrefix] = useState("");
  const { data, isLoading, error } = useObjects(bucketId, prefix);
  const upload = useUploadObject(bucketId, prefix);
  const remove = useDeleteObject(bucketId);
  const fileInput = useRef<HTMLInputElement>(null);
  const [toDelete, setToDelete] = useState<ObjectEntry | null>(null);

  const canWrite = permissions.includes("storage.write");
  const segments = prefix.split("/").filter(Boolean);

  function goTo(depth: number) {
    setPrefix(depth === 0 ? "" : `${segments.slice(0, depth).join("/")}/`);
  }

  async function onFiles(files: FileList | null) {
    if (!files) return;
    for (const file of Array.from(files)) {
      await upload.mutateAsync(file).catch(() => {});
    }
    if (fileInput.current) fileInput.current.value = "";
  }

  return (
    <>
      <PageHeader
        title={data?.bucket ?? t("title")}
        description={t("description")}
      >
        <Button variant="outline" onClick={() => router.push("/dashboard/buckets")}>
          <HugeiconsIcon icon={ArrowLeft01Icon} />
          {t("backToBuckets")}
        </Button>
        {canWrite ? (
          <Button onClick={() => fileInput.current?.click()} disabled={upload.isPending}>
            <HugeiconsIcon icon={Upload01Icon} />
            {upload.isPending ? t("uploading") : t("upload")}
          </Button>
        ) : null}
        <input
          ref={fileInput}
          type="file"
          multiple
          hidden
          onChange={(e) => onFiles(e.target.files)}
        />
      </PageHeader>

      {/* Breadcrumb */}
      <div className="mb-4 flex flex-wrap items-center gap-1 text-sm">
        <button
          type="button"
          onClick={() => goTo(0)}
          className="text-muted-foreground hover:text-foreground"
        >
          {data?.bucket ?? t("root")}
        </button>
        {segments.map((seg, i) => (
          <span key={i} className="flex items-center gap-1">
            <span className="text-muted-foreground/50">/</span>
            <button
              type="button"
              onClick={() => goTo(i + 1)}
              className="text-muted-foreground hover:text-foreground"
            >
              {seg}
            </button>
          </span>
        ))}
      </div>

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
              <TableHead className="hidden sm:table-cell">{t("size")}</TableHead>
              <TableHead className="hidden lg:table-cell">{t("modified")}</TableHead>
              <TableHead className="w-[1%]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i} className="h-12">
                  <TableCell colSpan={4}>
                    <Skeleton className="h-5 w-full" />
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <>
                {data?.folders.map((folder) => (
                  <TableRow
                    key={folder}
                    className="h-12 cursor-pointer"
                    onClick={() => setPrefix(folder)}
                  >
                    <TableCell className="font-medium">
                      <span className="flex items-center gap-2">
                        <HugeiconsIcon
                          icon={Folder01Icon}
                          className="size-4 text-primary"
                        />
                        {folder.slice(prefix.length)}
                      </span>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell" />
                    <TableCell className="hidden lg:table-cell" />
                    <TableCell />
                  </TableRow>
                ))}
                {data?.files.map((file) => (
                  <TableRow key={file.key} className="h-12">
                    <TableCell className="font-medium">
                      <span className="flex items-center gap-2">
                        <HugeiconsIcon
                          icon={File01Icon}
                          className="size-4 text-muted-foreground"
                        />
                        {file.name}
                      </span>
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground sm:table-cell">
                      {formatBytes(file.size)}
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground lg:table-cell">
                      {dateFmt.format(new Date(file.updatedAt))}
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Button asChild variant="ghost" size="icon" aria-label={t("download")}>
                          <a href={objectDownloadUrl(bucketId, file.key)} download>
                            <HugeiconsIcon icon={Download01Icon} />
                          </a>
                        </Button>
                        {canWrite ? (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setToDelete(file)}
                            aria-label={t("delete")}
                          >
                            <HugeiconsIcon icon={Delete02Icon} />
                          </Button>
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {!data?.folders.length && !data?.files.length ? (
                  <TableRow className="h-12">
                    <TableCell colSpan={4} className="text-center text-muted-foreground">
                      {t("empty")}
                    </TableCell>
                  </TableRow>
                ) : null}
              </>
            )}
          </TableBody>
        </Table>
      </div>

      <PolicyEditor bucketId={bucketId} canWrite={canWrite} />

      <Dialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("deleteTitle")}</DialogTitle>
            <DialogDescription>
              <span className="font-mono">{toDelete?.name}</span>
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
                  await remove.mutateAsync(toDelete.key);
                } finally {
                  setToDelete(null);
                }
              }}
            >
              {tc("delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function PolicyEditor({
  bucketId,
  canWrite,
}: {
  bucketId: string;
  canWrite: boolean;
}) {
  const t = useTranslations("objects");
  const tc = useTranslations("common");
  const { data } = useBucketPolicy(bucketId);
  const save = useSetBucketPolicy(bucketId);
  const [draft, setDraft] = useState<string | null>(null);
  const value = draft ?? data?.policy ?? "";

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle>{t("policy")}</CardTitle>
        <CardDescription>{t("policyDescription")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Textarea
          value={value}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={t("policyPlaceholder")}
          className="min-h-40 font-mono text-xs"
          disabled={!canWrite}
        />
        {canWrite ? (
          <Button
            onClick={() => save.mutate(value)}
            disabled={save.isPending}
          >
            {save.isPending ? tc("saving") : t("savePolicy")}
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}
