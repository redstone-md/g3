import { type NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@/generated/prisma/client";
import { authorize } from "@/lib/api-auth";
import { logAudit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { parseListQuery } from "@/lib/list-query";
import { hashPassword } from "@/lib/password";
import type { UserDTO } from "@/lib/types";
import { createUserSchema } from "@/lib/validators";

type UserRow = {
  id: string;
  email: string;
  name: string | null;
  mustChangePassword: boolean;
  avatar: string | null;
  createdAt: Date;
  roles: { id: string; name: string }[];
};

function toDTO(user: UserRow): UserDTO {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    mustChangePassword: user.mustChangePassword,
    avatar: user.avatar,
    createdAt: user.createdAt.toISOString(),
    roles: user.roles.map((r) => ({ id: r.id, name: r.name })),
  };
}

export async function GET(request: NextRequest) {
  const { error } = await authorize("users.read");
  if (error) return error;

  const { q, page, pageSize, sort, order, skip } = parseListQuery(request.url, {
    sortFields: ["createdAt", "email", "name"],
    defaultSort: "createdAt",
  });

  const where: Prisma.UserWhereInput = q
    ? {
        OR: [
          { email: { contains: q, mode: "insensitive" } },
          { name: { contains: q, mode: "insensitive" } },
        ],
      }
    : {};

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      include: { roles: { select: { id: true, name: true } } },
      orderBy: { [sort]: order },
      skip,
      take: pageSize,
    }),
    prisma.user.count({ where }),
  ]);

  return NextResponse.json({ items: users.map(toDTO), total, page, pageSize });
}

export async function POST(request: NextRequest) {
  const { user: actor, error } = await authorize("users.create");
  if (error) return error;

  const parsed = createUserSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid user data." }, { status: 422 });
  }

  try {
    const user = await prisma.user.create({
      data: {
        email: parsed.data.email,
        name: parsed.data.name || null,
        passwordHash: await hashPassword(parsed.data.password),
        roles: { connect: parsed.data.roleIds.map((id) => ({ id })) },
      },
      include: { roles: { select: { id: true, name: true } } },
    });
    await logAudit({
      action: "user.create",
      actorId: actor.id,
      actorEmail: actor.email,
      targetType: "user",
      targetId: user.id,
      metadata: { email: user.email },
    });
    return NextResponse.json(toDTO(user), { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "A user with that email already exists." },
      { status: 409 },
    );
  }
}
