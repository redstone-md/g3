"use client";

import {
  ArrowLeft01Icon,
  Cancel01Icon,
  CheckmarkCircle02Icon,
  Delete02Icon,
  Download01Icon,
  File01Icon,
  Folder01Icon,
  Upload01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useQueryClient } from "@tanstack/react-query";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import {
  type ObjectEntry,
  objectDownloadUrl,
  useBucketPolicy,
  useDeleteObject,
  useObjects,
  useSetBucketPolicy,
} from "@/hooks/use-objects";
import { type UploadHandle, uploadFile } from "@/lib/upload";
import { cn } from "@/lib/utils";

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

function formatSpeed(bytesPerSec: number): string {
  if (!bytesPerSec || bytesPerSec < 1) return "…";
  return `${formatBytes(bytesPerSec)}/s`;
}

interface UploadTask {
  id: string;
  name: string;
  total: number;
  loaded: number;
  speed: number;
  status: "uploading" | "done" | "error";
  error?: string;
  handle: UploadHandle;
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
  const qc = useQueryClient();
  const remove = useDeleteObject(bucketId);
  const fileInput = useRef<HTMLInputElement>(null);
  const [toDelete, setToDelete] = useState<ObjectEntry | null>(null);
  const [uploads, setUploads] = useState<UploadTask[]>([]);
  const speedRef = useRef<Record<string, { t: number; b: number }>>({});

  const canWrite = permissions.includes("storage.write");
  const segments = prefix.split("/").filter(Boolean);

  function goTo(depth: number) {
    setPrefix(depth === 0 ? "" : `${segments.slice(0, depth).join("/")}/`);
  }

  function patch(id: string, fn: (u: UploadTask) => UploadTask) {
    setUploads((prev) => prev.map((u) => (u.id === id ? fn(u) : u)));
  }

  function onProgress(id: string, loaded: number) {
    const now = Date.now();
    const meta = speedRef.current[id] ?? { t: now, b: 0 };
    const dt = now - meta.t;
    patch(id, (u) => {
      let speed = u.speed;
      if (dt > 300) {
        const inst = ((loaded - meta.b) / dt) * 1000; // bytes/s
        speed = u.speed ? u.speed * 0.6 + inst * 0.4 : inst;
        speedRef.current[id] = { t: now, b: loaded };
      }
      return { ...u, loaded, speed };
    });
  }

  function onFiles(files: FileList | null) {
    if (!files) return;
    for (const file of Array.from(files)) {
      const id = `${file.name}-${file.size}-${Math.random().toString(36).slice(2)}`;
      const objectKey = prefix + file.name;
      speedRef.current[id] = { t: Date.now(), b: 0 };
      const handle = uploadFile({
        bucketId,
        key: objectKey,
        file,
        onProgress: (loaded) => onProgress(id, loaded),
      });
      setUploads((prev) => [
        ...prev,
        {
          id,
          name: file.name,
          total: file.size,
          loaded: 0,
          speed: 0,
          status: "uploading",
          handle,
        },
      ]);
      handle.promise.then(
        () => {
          patch(id, (u) => ({
            ...u,
            status: "done",
            loaded: u.total,
            speed: 0,
          }));
          qc.invalidateQueries({ queryKey: ["objects", bucketId] });
          window.setTimeout(
            () => setUploads((prev) => prev.filter((u) => u.id !== id)),
            4000,
          );
        },
        (err: unknown) => {
          if (err instanceof DOMException && err.name === "AbortError") {
            setUploads((prev) => prev.filter((u) => u.id !== id));
            return;
          }
          patch(id, (u) => ({
            ...u,
            status: "error",
            error: err instanceof Error ? err.message : String(err),
          }));
        },
      );
    }
    if (fileInput.current) fileInput.current.value = "";
  }

  return (
    <>
      <PageHeader
        title={data?.bucket ?? t("title")}
        description={t("description")}
      >
        <Button
          variant="outline"
          onClick={() => router.push("/dashboard/buckets")}
        >
          <HugeiconsIcon icon={ArrowLeft01Icon} />
          {t("backToBuckets")}
        </Button>
        {canWrite ? (
          <Button onClick={() => fileInput.current?.click()}>
            <HugeiconsIcon icon={Upload01Icon} />
            {t("upload")}
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

      {uploads.length > 0 ? <UploadsPanel uploads={uploads} /> : null}

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
              <TableHead className="hidden sm:table-cell">
                {t("size")}
              </TableHead>
              <TableHead className="hidden lg:table-cell">
                {t("modified")}
              </TableHead>
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
                        <Button
                          asChild
                          variant="ghost"
                          size="icon"
                          aria-label={t("download")}
                        >
                          <a
                            href={objectDownloadUrl(bucketId, file.key)}
                            download
                          >
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
                    <TableCell
                      colSpan={4}
                      className="text-center text-muted-foreground"
                    >
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

function UploadsPanel({ uploads }: { uploads: UploadTask[] }) {
  const t = useTranslations("objects");
  return (
    <Card className="mb-4">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">{t("uploads")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {uploads.map((u) => {
          const pct = u.total
            ? Math.min(100, Math.round((u.loaded / u.total) * 100))
            : 0;
          return (
            <div key={u.id} className="space-y-1.5">
              <div className="flex items-center gap-2 text-sm">
                {u.status === "done" ? (
                  <HugeiconsIcon
                    icon={CheckmarkCircle02Icon}
                    className="size-4 shrink-0 text-primary"
                  />
                ) : null}
                <span className="truncate font-medium">{u.name}</span>
                <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                  {u.status === "error" ? (
                    <span className="text-destructive">{u.error}</span>
                  ) : u.status === "done" ? (
                    t("uploadDone")
                  ) : (
                    `${formatBytes(u.loaded)} / ${formatBytes(u.total)} · ${formatSpeed(u.speed)} · ${pct}%`
                  )}
                </span>
                {u.status === "uploading" ? (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-6 shrink-0"
                    onClick={() => u.handle.abort()}
                    aria-label={t("cancelUpload")}
                  >
                    <HugeiconsIcon icon={Cancel01Icon} className="size-3.5" />
                  </Button>
                ) : null}
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className={cn(
                    "h-full rounded-full transition-[width] duration-200",
                    u.status === "error" ? "bg-destructive" : "bg-primary",
                  )}
                  style={{ width: `${u.status === "done" ? 100 : pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
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
          <Button onClick={() => save.mutate(value)} disabled={save.isPending}>
            {save.isPending ? tc("saving") : t("savePolicy")}
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}
