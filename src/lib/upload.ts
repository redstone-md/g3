/**
 * Browser-side upload engine for the file manager.
 *
 * Small files go in a single request; larger files are sliced and uploaded as
 * **multipart parts in parallel**, so each request stays small (proxy/CDN
 * friendly) and we can report aggregate progress + speed. All requests are
 * same-origin and session-authenticated (cookies sent automatically).
 */

export const PART_SIZE = 16 * 1024 * 1024; // 16 MiB per part
export const CONCURRENCY = 4; // parallel part uploads

export interface UploadHandle {
  promise: Promise<void>;
  abort: () => void;
}

interface SendOpts {
  method: string;
  url: string;
  body?: Blob | null;
  signal: AbortSignal;
  onProgress?: (loaded: number) => void;
}

function send({
  method,
  url,
  body,
  signal,
  onProgress,
}: SendOpts): Promise<string> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException("aborted", "AbortError"));
      return;
    }
    const xhr = new XMLHttpRequest();
    xhr.open(method, url);
    if (onProgress && xhr.upload) {
      xhr.upload.onprogress = (e) => onProgress(e.loaded);
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(xhr.responseText);
      } else {
        let message = xhr.statusText || `HTTP ${xhr.status}`;
        try {
          message = JSON.parse(xhr.responseText).error ?? message;
        } catch {
          /* keep status text */
        }
        reject(new Error(message));
      }
    };
    xhr.onerror = () => reject(new Error("Network error"));
    xhr.onabort = () => reject(new DOMException("aborted", "AbortError"));
    signal.addEventListener("abort", () => xhr.abort(), { once: true });
    xhr.send(body ?? null);
  });
}

/**
 * Upload one file, reporting cumulative bytes sent via onProgress. Returns a
 * handle whose `abort()` cancels in-flight parts and the server-side upload.
 */
export function uploadFile(params: {
  bucketId: string;
  key: string;
  file: File;
  onProgress: (loaded: number) => void;
}): UploadHandle {
  const { bucketId, key, file, onProgress } = params;
  const controller = new AbortController();
  const { signal } = controller;

  async function run() {
    // Small file: one request.
    if (file.size <= PART_SIZE) {
      await send({
        method: "POST",
        url: `/api/buckets/${bucketId}/object?key=${encodeURIComponent(key)}`,
        body: file,
        signal,
        onProgress,
      });
      return;
    }

    // Large file: parallel multipart.
    const ct = file.type || "application/octet-stream";
    const initRaw = await send({
      method: "POST",
      url: `/api/buckets/${bucketId}/uploads?key=${encodeURIComponent(key)}&contentType=${encodeURIComponent(ct)}`,
      signal,
    });
    const uploadId = JSON.parse(initRaw).uploadId as string;

    try {
      const partCount = Math.ceil(file.size / PART_SIZE);
      const loaded = new Array<number>(partCount).fill(0);
      const report = () => onProgress(loaded.reduce((a, b) => a + b, 0));

      let nextPart = 0;
      async function worker() {
        while (true) {
          const i = nextPart++;
          if (i >= partCount) return;
          const start = i * PART_SIZE;
          const end = Math.min(file.size, start + PART_SIZE);
          await send({
            method: "PUT",
            url: `/api/buckets/${bucketId}/uploads?uploadId=${encodeURIComponent(uploadId)}&partNumber=${i + 1}`,
            body: file.slice(start, end),
            signal,
            onProgress: (b) => {
              loaded[i] = b;
              report();
            },
          });
          loaded[i] = end - start;
          report();
        }
      }

      await Promise.all(
        Array.from({ length: Math.min(CONCURRENCY, partCount) }, worker),
      );

      await send({
        method: "POST",
        url: `/api/buckets/${bucketId}/uploads/complete?uploadId=${encodeURIComponent(uploadId)}`,
        signal,
      });
    } catch (err) {
      // Best-effort: free the staged parts on the server.
      void fetch(
        `/api/buckets/${bucketId}/uploads?uploadId=${encodeURIComponent(uploadId)}`,
        { method: "DELETE", credentials: "same-origin" },
      ).catch(() => {});
      throw err;
    }
  }

  return { promise: run(), abort: () => controller.abort() };
}
