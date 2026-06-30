// One-off: migrate single-role users (legacy `roleId`) to the many-to-many
// `roleIds`/`roles` relation. Safe to run multiple times.
// Usage: node scripts/migrate-to-multi-role.mjs
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client.ts";

const prisma = new PrismaClient();

async function main() {
  // Read raw docs so we can see the legacy `roleId` the typed client no longer maps.
  const res = await prisma.$runCommandRaw({ find: "User", filter: {} });
  const docs = res?.cursor?.firstBatch ?? [];

  let migrated = 0;
  for (const doc of docs) {
    const id = doc._id?.$oid ?? doc._id;
    const legacyRoleId = doc.roleId?.$oid ?? doc.roleId;
    const alreadyMulti = Array.isArray(doc.roleIds) && doc.roleIds.length > 0;
    if (legacyRoleId && !alreadyMulti) {
      await prisma.user.update({
        where: { id },
        data: { roles: { connect: { id: legacyRoleId } } },
      });
      migrated += 1;
    }
  }

  // Drop the legacy field everywhere.
  await prisma.$runCommandRaw({
    update: "User",
    updates: [{ q: {}, u: { $unset: { roleId: "" } }, multi: true }],
  });

  console.log(
    `Migrated ${migrated} user(s) to multi-role; legacy roleId unset.`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
