import "server-only";
import { PrismaClient } from "@/generated/prisma/client";

// Reuse a single PrismaClient across HMR reloads in dev to avoid
// exhausting the MongoDB connection pool.
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
