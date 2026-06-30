import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/dal";
import { prisma } from "@/lib/db";

/** Download all of the signed-in user's own data as JSON (GDPR-style export). */
export async function GET() {
  const user = await getCurrentUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [record, sessions, auditEvents] = await Promise.all([
    prisma.user.findUnique({
      where: { id: user.id },
      include: { roles: { select: { name: true, permissions: true } } },
    }),
    prisma.session.findMany({
      where: { userId: user.id },
      select: { ip: true, userAgent: true, createdAt: true, expiresAt: true },
    }),
    prisma.auditLog.findMany({
      where: { actorId: user.id },
      orderBy: { createdAt: "desc" },
      take: 500,
    }),
  ]);

  const data = {
    exportedAt: new Date().toISOString(),
    profile: {
      id: record?.id,
      email: record?.email,
      name: record?.name,
      avatar: record?.avatar,
      theme: record?.theme,
      locale: record?.locale,
      createdAt: record?.createdAt,
      roles: record?.roles,
    },
    sessions,
    activity: auditEvents,
  };

  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="ribbon-account-${user.id}.json"`,
    },
  });
}
