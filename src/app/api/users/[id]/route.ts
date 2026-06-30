import { type NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@/generated/prisma/client";
import { adminUserCount, roleIdsGrantAdmin } from "@/lib/admin-guard";
import { authorize } from "@/lib/api-auth";
import { logAudit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/password";
import { updateUserSchema } from "@/lib/validators";

type Context = { params: Promise<{ id: string }> };

const LAST_ADMIN =
  "This is the last administrator — grant the admin role to someone else first.";

export async function PATCH(request: NextRequest, { params }: Context) {
  const { user: actor, error } = await authorize("users.update");
  if (error) return error;

  const { id } = await params;
  const parsed = updateUserSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid user data." }, { status: 422 });
  }

  // Block demoting the last admin out of every admin-capable role (inheritance-aware).
  if (parsed.data.roleIds !== undefined) {
    const target = await prisma.user.findUnique({
      where: { id },
      include: { roles: { select: { id: true } } },
    });
    const wasAdmin = await roleIdsGrantAdmin(
      target?.roles.map((r) => r.id) ?? [],
    );
    if (wasAdmin) {
      const willBeAdmin = await roleIdsGrantAdmin(parsed.data.roleIds);
      if (!willBeAdmin && (await adminUserCount()) <= 1) {
        return NextResponse.json({ error: LAST_ADMIN }, { status: 400 });
      }
    }
  }

  const data: Prisma.UserUpdateInput = {};
  if (parsed.data.name !== undefined) data.name = parsed.data.name || null;
  if (parsed.data.roleIds !== undefined) {
    data.roles = { set: parsed.data.roleIds.map((rid) => ({ id: rid })) };
  }
  if (parsed.data.password) {
    data.passwordHash = await hashPassword(parsed.data.password);
  }

  try {
    const updated = await prisma.user.update({ where: { id }, data });
    await logAudit({
      action: "user.update",
      actorId: actor.id,
      actorEmail: actor.email,
      targetType: "user",
      targetId: id,
    });
    return NextResponse.json({ id: updated.id });
  } catch {
    return NextResponse.json(
      { error: "Could not update user." },
      { status: 400 },
    );
  }
}

export async function DELETE(_request: NextRequest, { params }: Context) {
  const { user, error } = await authorize("users.delete");
  if (error) return error;

  const { id } = await params;
  if (id === user.id) {
    return NextResponse.json(
      { error: "You cannot delete your own account." },
      { status: 400 },
    );
  }

  // Never delete the last administrator (inheritance-aware).
  const target = await prisma.user.findUnique({
    where: { id },
    include: { roles: { select: { id: true } } },
  });
  if (
    (await roleIdsGrantAdmin(target?.roles.map((r) => r.id) ?? [])) &&
    (await adminUserCount()) <= 1
  ) {
    return NextResponse.json({ error: LAST_ADMIN }, { status: 400 });
  }

  // Detach from roles first (Mongo m-n keeps ids on both sides).
  await prisma.user
    .update({ where: { id }, data: { roles: { set: [] } } })
    .catch(() => {});
  await prisma.user.delete({ where: { id } }).catch(() => {});
  await logAudit({
    action: "user.delete",
    actorId: user.id,
    actorEmail: user.email,
    targetType: "user",
    targetId: id,
    metadata: { email: target?.email },
  });
  return NextResponse.json({ id });
}
