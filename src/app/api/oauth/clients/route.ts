import { type NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@/generated/prisma/client";
import { authorize } from "@/lib/api-auth";
import { logAudit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { parseListQuery } from "@/lib/list-query";
import { randomToken, sha256 } from "@/lib/oauth/crypto";
import type { OAuthClientDTO } from "@/lib/types";
import { oauthClientSchema } from "@/lib/validators";

type Row = {
  id: string;
  clientId: string;
  name: string;
  redirectUris: string[];
  scopes: string[];
  isPublic: boolean;
  createdAt: Date;
};

function toDTO(c: Row): OAuthClientDTO {
  return {
    id: c.id,
    clientId: c.clientId,
    name: c.name,
    redirectUris: c.redirectUris,
    scopes: c.scopes,
    isPublic: c.isPublic,
    createdAt: c.createdAt.toISOString(),
  };
}

export async function GET(request: NextRequest) {
  const { error } = await authorize("oauth.read");
  if (error) return error;

  const { q, page, pageSize, sort, order, skip } = parseListQuery(request.url, {
    sortFields: ["createdAt", "name"],
    defaultSort: "createdAt",
  });

  const where: Prisma.OAuthClientWhereInput = q
    ? {
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { clientId: { contains: q, mode: "insensitive" } },
        ],
      }
    : {};

  const [items, total] = await Promise.all([
    prisma.oAuthClient.findMany({
      where,
      orderBy: { [sort]: order },
      skip,
      take: pageSize,
    }),
    prisma.oAuthClient.count({ where }),
  ]);

  return NextResponse.json({ items: items.map(toDTO), total, page, pageSize });
}

export async function POST(request: NextRequest) {
  const { user: actor, error } = await authorize("oauth.create");
  if (error) return error;

  const parsed = oauthClientSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid client data." },
      { status: 422 },
    );
  }

  const clientId = `ribbon_${randomToken(12)}`;
  const secret = parsed.data.isPublic ? null : randomToken(32);

  const client = await prisma.oAuthClient.create({
    data: {
      clientId,
      secretHash: secret ? sha256(secret) : null,
      name: parsed.data.name,
      redirectUris: parsed.data.redirectUris,
      scopes: parsed.data.scopes,
      isPublic: parsed.data.isPublic,
    },
  });

  await logAudit({
    action: "oauth.client.create",
    actorId: actor.id,
    actorEmail: actor.email,
    targetType: "oauth_client",
    targetId: client.id,
    metadata: { name: client.name, clientId: client.clientId },
  });
  // Secret is returned exactly once, in plaintext.
  return NextResponse.json(
    { ...toDTO(client), clientSecret: secret },
    { status: 201 },
  );
}
