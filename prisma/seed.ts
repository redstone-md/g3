import "dotenv/config";
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { PrismaClient } from "../src/generated/prisma/client";
import { ALL_PERMISSIONS } from "../src/lib/permissions";

const prisma = new PrismaClient();

const ADMIN_ROLE = "Administrator";
const MEMBER_ROLE = "Member";

/** A readable, copy-pasteable random password. */
function generatePassword(): string {
  return crypto.randomBytes(15).toString("base64url");
}

function banner(email: string, password: string): void {
  const line = "─".repeat(54);
  console.log(`\n┌${line}┐`);
  console.log("│  ADMIN ACCOUNT CREATED — store these credentials now │");
  console.log(`├${line}┤`);
  console.log(`│  Email:    ${email.padEnd(41)}│`);
  console.log(`│  Password: ${password.padEnd(41)}│`);
  console.log(`├${line}┤`);
  console.log("│  You will be asked to change it on first sign-in.    │");
  console.log(`└${line}┘\n`);
}

async function main(): Promise<void> {
  // First-run guard: if any user exists, the system is already initialized.
  const existingUsers = await prisma.user.count();
  if (existingUsers > 0) {
    console.log("Seed skipped — users already exist (not first run).");
    return;
  }

  // System roles are upserted so re-running after a partial seed is safe.
  const adminRole = await prisma.role.upsert({
    where: { name: ADMIN_ROLE },
    update: { permissions: ALL_PERMISSIONS },
    create: {
      name: ADMIN_ROLE,
      description: "Full system access. Cannot be deleted.",
      permissions: ALL_PERMISSIONS,
      isSystem: true,
    },
  });

  await prisma.role.upsert({
    where: { name: MEMBER_ROLE },
    update: {},
    create: {
      name: MEMBER_ROLE,
      description: "Default role for new members.",
      permissions: ["styleguide.view"],
      isSystem: true,
    },
  });

  const email = (process.env.ADMIN_EMAIL ?? "admin@ribbon.local").toLowerCase();
  const password = generatePassword();

  await prisma.user.create({
    data: {
      email,
      name: "Administrator",
      passwordHash: await bcrypt.hash(password, 12),
      mustChangePassword: true,
      roles: { connect: { id: adminRole.id } },
    },
  });

  banner(email, password);
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
