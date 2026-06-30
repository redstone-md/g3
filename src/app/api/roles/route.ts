import { type NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@/generated/prisma/client";
import { authorize } from "@/lib/api-auth";
import { logAudit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { parseListQuery } from "@/lib/list-query";
import { sanitizePermissions } from "@/lib/permissions";
import type { RoleDTO } from "@/lib/types";
import { roleSchema } from "@/lib/validators";

function toDTO(role: {
  id: string;
  name: string;
  description: string | null;
  permissions: string[];
  parentIds: string[];
  isSystem: boolean;
  createdAt: Date;
  _count: { users: number };
}): RoleDTO {
  return {
    id: role.id,
    name: role.name,
    description: role.description,
    permissions: role.permissions,
    parentIds: role.parentIds,
    isSystem: role.isSystem,
    userCount: role._count.users,
    createdAt: role.createdAt.toISOString(),
  };
}

export async function GET(request: NextRequest) {
  const { error } = await authorize("roles.read");
  if (error) return error;

  const { q, page, pageSize, sort, order, skip } = parseListQuery(request.url, {
    sortFields: ["createdAt", "name"],
    defaultSort: "name",
  });

  const where: Prisma.RoleWhereInput = q
    ? {
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { description: { contains: q, mode: "insensitive" } },
        ],
      }
    : {};

  const orderBy =
    sort === "name"
      ? [{ isSystem: "desc" as const }, { name: order }]
      : { [sort]: order };

  const [roles, total] = await Promise.all([
    prisma.role.findMany({
      where,
      orderBy,
      include: { _count: { select: { users: true } } },
      skip,
      take: pageSize,
    }),
    prisma.role.count({ where }),
  ]);

  return NextResponse.json({ items: roles.map(toDTO), total, page, pageSize });
}

export async function POST(request: NextRequest) {
  const { user: actor, error } = await authorize("roles.create");
  if (error) return error;

  const parsed = roleSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid role data." }, { status: 422 });
  }

  // Keep only parent ids that reference existing roles (no cycle possible on create).
  const existing = await prisma.role.findMany({ select: { id: true } });
  const validIds = new Set(existing.map((r) => r.id));
  const parentIds = [...new Set(parsed.data.parentIds)].filter((pid) =>
    validIds.has(pid),
  );

  try {
    const role = await prisma.role.create({
      data: {
        name: parsed.data.name,
        description: parsed.data.description || null,
        permissions: sanitizePermissions(parsed.data.permissions),
        parentIds,
      },
      include: { _count: { select: { users: true } } },
    });
    await logAudit({
      action: "role.create",
      actorId: actor.id,
      actorEmail: actor.email,
      targetType: "role",
      targetId: role.id,
      metadata: { name: role.name },
    });
    return NextResponse.json(toDTO(role), { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "A role with that name already exists." },
      { status: 409 },
    );
  }
}
