import { type NextRequest, NextResponse } from "next/server";
import { logAudit } from "@/lib/audit";
import { getCurrentUser } from "@/lib/dal";
import { prisma } from "@/lib/db";

type Context = { params: Promise<{ id: string }> };

/** Revoke one of the signed-in user's own sessions. */
export async function DELETE(_request: NextRequest, { params }: Context) {
  const user = await getCurrentUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  // Scope to the owner so a user can only revoke their own sessions.
  const result = await prisma.session.deleteMany({
    where: { id, userId: user.id },
  });
  if (result.count === 0) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  await logAudit({
    action: "session.revoke",
    actorId: user.id,
    actorEmail: user.email,
    targetType: "session",
    targetId: id,
  });
  return NextResponse.json({ id });
}
