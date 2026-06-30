import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

export interface ObjectEntry {
  key: string;
  name: string;
  size: number;
  etag: string;
  contentType: string;
  updatedAt: string;
  isMultipart: boolean;
}

export interface ObjectListing {
  bucket: string;
  prefix: string;
  folders: string[];
  files: ObjectEntry[];
  truncated: boolean;
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? "Request failed.");
  return body as T;
}

const key = (bucketId: string, prefix: string) =>
  ["objects", bucketId, prefix] as const;

export function useObjects(bucketId: string, prefix: string) {
  return useQuery({
    queryKey: key(bucketId, prefix),
    queryFn: () =>
      request<ObjectListing>(
        `/api/buckets/${bucketId}/objects?prefix=${encodeURIComponent(prefix)}`,
      ),
    enabled: !!bucketId,
  });
}

export function objectDownloadUrl(bucketId: string, objectKey: string): string {
  return `/api/buckets/${bucketId}/object?key=${encodeURIComponent(objectKey)}`;
}

export function useUploadObject(bucketId: string, prefix: string) {
  const qc = useQueryClient();
  const t = useTranslations("objects");
  return useMutation({
    mutationFn: async (file: File) => {
      const objectKey = prefix + file.name;
      const res = await fetch(
        `/api/buckets/${bucketId}/object?key=${encodeURIComponent(objectKey)}`,
        {
          method: "POST",
          headers: { "Content-Type": file.type || "application/octet-stream" },
          body: file,
        },
      );
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "Upload failed.");
      return body;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["objects", bucketId] });
      toast.success(t("uploaded"));
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteObject(bucketId: string) {
  const qc = useQueryClient();
  const t = useTranslations("objects");
  return useMutation({
    mutationFn: (objectKey: string) =>
      request(
        `/api/buckets/${bucketId}/object?key=${encodeURIComponent(objectKey)}`,
        { method: "DELETE" },
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["objects", bucketId] });
      toast.success(t("deleted"));
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useBucketPolicy(bucketId: string) {
  return useQuery({
    queryKey: ["policy", bucketId],
    queryFn: () =>
      request<{ policy: string }>(`/api/buckets/${bucketId}/policy`),
    enabled: !!bucketId,
  });
}

export function useSetBucketPolicy(bucketId: string) {
  const qc = useQueryClient();
  const t = useTranslations("objects");
  return useMutation({
    mutationFn: (policy: string) =>
      request(`/api/buckets/${bucketId}/policy`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ policy }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["policy", bucketId] });
      toast.success(t("policySaved"));
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
