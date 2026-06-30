import { type NextRequest, NextResponse } from "next/server";
import { authorize } from "@/lib/api-auth";
import { logAudit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { oauthClientSchema } from "@/lib/validators";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: Context) {
  const { user: actor, error } = await authorize("oauth.update");
  if (error) return error;

  const { id } = await params;
  const parsed = oauthClientSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid client data." },
      { status: 422 },
    );
  }

  try {
    const updated = await prisma.oAuthClient.update({
      where: { id },
      data: {
        name: parsed.data.name,
        redirectUris: parsed.data.redirectUris,
        scopes: parsed.data.scopes,
        isPublic: parsed.data.isPublic,
      },
    });
    await logAudit({
      action: "oauth.client.update",
      actorId: actor.id,
      actorEmail: actor.email,
      targetType: "oauth_client",
      targetId: id,
    });
    return NextResponse.json({ id: updated.id });
  } catch {
    return NextResponse.json(
      { error: "Could not update client." },
      { status: 400 },
    );
  }
}

export async function DELETE(_request: NextRequest, { params }: Context) {
  const { user: actor, error } = await authorize("oauth.delete");
  if (error) return error;

  const { id } = await params;
  const client = await prisma.oAuthClient.findUnique({ where: { id } });
  if (!client)
    return NextResponse.json({ error: "Not found." }, { status: 404 });

  // Revoke any outstanding codes/tokens for this client.
  await prisma.oAuthAuthCode.deleteMany({
    where: { clientId: client.clientId },
  });
  await prisma.oAuthToken.deleteMany({ where: { clientId: client.clientId } });
  await prisma.oAuthClient.delete({ where: { id } });
  await logAudit({
    action: "oauth.client.delete",
    actorId: actor.id,
    actorEmail: actor.email,
    targetType: "oauth_client",
    targetId: id,
    metadata: { name: client.name, clientId: client.clientId },
  });
  return NextResponse.json({ id });
}
