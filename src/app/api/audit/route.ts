import { type NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@/generated/prisma/client";
import { authorize } from "@/lib/api-auth";
import { prisma } from "@/lib/db";
import { parseListQuery } from "@/lib/list-query";
import type { AuditLogDTO } from "@/lib/types";

export async function GET(request: NextRequest) {
  const { error } = await authorize("audit.read");
  if (error) return error;

  const { q, page, pageSize, skip } = parseListQuery(request.url, {
    sortFields: ["createdAt"],
    defaultSort: "createdAt",
  });

  const where: Prisma.AuditLogWhereInput = q
    ? {
        OR: [
          { action: { contains: q, mode: "insensitive" } },
          { actorEmail: { contains: q, mode: "insensitive" } },
        ],
      }
    : {};

  const [rows, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
    }),
    prisma.auditLog.count({ where }),
  ]);

  const items: AuditLogDTO[] = rows.map((r) => ({
    id: r.id,
    action: r.action,
    actorEmail: r.actorEmail,
    targetType: r.targetType,
    targetId: r.targetId,
    ip: r.ip,
    createdAt: r.createdAt.toISOString(),
  }));

  return NextResponse.json({ items, total, page, pageSize });
}
