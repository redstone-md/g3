// Sync the Administrator system role to the full current permission catalog.
// Run after adding new permission keys (the first-run seed won't re-run).
// Usage: node scripts/sync-admin-permissions.mjs
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client.ts";
import { ALL_PERMISSIONS } from "../src/lib/permissions.ts";

const prisma = new PrismaClient();

async function main() {
  const res = await prisma.role.updateMany({
    where: { name: "Administrator", isSystem: true },
    data: { permissions: ALL_PERMISSIONS },
  });
  console.log(
    `Administrator role synced (${res.count}) → ${ALL_PERMISSIONS.length} permissions.`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
