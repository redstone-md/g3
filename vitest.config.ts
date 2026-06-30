import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      // Map the "@/..." path alias used across the app.
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // The real "server-only" package throws outside an RSC graph.
      "server-only": fileURLToPath(
        new URL("./tests/stub-empty.ts", import.meta.url),
      ),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
});
