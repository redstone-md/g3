import "server-only";
import pino from "pino";

/**
 * App logger. Plain JSON (no pretty transport) to stay compatible with the
 * Next.js server bundle — pipe through `pino-pretty` in the terminal during dev
 * if you want colors: `next dev | npx pino-pretty`.
 */
export const logger = pino({
  level:
    process.env.LOG_LEVEL ??
    (process.env.NODE_ENV === "production" ? "info" : "debug"),
  base: undefined, // drop pid/hostname noise
});
