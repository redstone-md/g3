/**
 * Thin client-side fetch wrapper for the G3 Go backend.
 *
 * The whole frontend is a static SPA served by the Go binary, so every data
 * call goes through here against same-origin `/api/*` endpoints. JSON in, JSON
 * out; non-2xx responses throw an {@link ApiError} carrying the server message.
 */

export class ApiError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const hasBody = init?.body != null;
  const res = await fetch(path, {
    credentials: "same-origin",
    ...init,
    headers: {
      ...(hasBody ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
  });

  const text = await res.text();
  const body = text ? JSON.parse(text) : null;

  if (!res.ok) {
    const message =
      (body && typeof body.error === "string" && body.error) ||
      res.statusText ||
      "Request failed";
    throw new ApiError(message, res.status);
  }
  return body as T;
}

/** Extract a user-facing message from a thrown error. */
export function apiErrorMessage(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}
