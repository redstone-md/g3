import { NextResponse } from "next/server";
import { logAudit } from "@/lib/audit";
import { getCurrentUser } from "@/lib/dal";
import { prisma } from "@/lib/db";
import { currentSessionId } from "@/lib/session";
import type { SessionDTO } from "@/lib/types";

/** List the signed-in user's own sessions, marking the current one. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [sessions, currentId] = await Promise.all([
    prisma.session.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
    }),
    currentSessionId(),
  ]);

  const items: SessionDTO[] = sessions.map((s) => ({
    id: s.id,
    userAgent: s.userAgent,
    ip: s.ip,
    createdAt: s.createdAt.toISOString(),
    current: s.id === currentId,
  }));
  return NextResponse.json(items);
}

/** Revoke every session except the current one. */
export async function DELETE() {
  const user = await getCurrentUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const currentId = await currentSessionId();
  await prisma.session.deleteMany({
    where: { userId: user.id, id: { not: currentId ?? undefined } },
  });
  await logAudit({
    action: "session.revoke_others",
    actorId: user.id,
    actorEmail: user.email,
  });
  return NextResponse.json({ ok: true });
}
