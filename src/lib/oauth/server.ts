import "server-only";
import { prisma } from "@/lib/db";
import {
  ACCESS_TTL_S,
  CODE_TTL_S,
  REFRESH_TTL_S,
  randomToken,
  safeEqualHex,
  sha256,
} from "@/lib/oauth/crypto";

/** Load a client and (for confidential clients) verify its secret. */
export async function authenticateClient(
  clientId: string,
  clientSecret?: string,
) {
  const client = await prisma.oAuthClient.findUnique({ where: { clientId } });
  if (!client) return null;
  if (client.isPublic) return client; // public clients rely on PKCE only
  if (!clientSecret || !client.secretHash) return null;
  return safeEqualHex(sha256(clientSecret), client.secretHash) ? client : null;
}

export async function getClient(clientId: string) {
  return prisma.oAuthClient.findUnique({ where: { clientId } });
}

export function redirectUriAllowed(
  client: { redirectUris: string[] },
  uri: string,
) {
  return client.redirectUris.includes(uri);
}

/** Mint a one-time authorization code. Returns the raw code. */
export async function createAuthorizationCode(input: {
  clientId: string;
  userId: string;
  redirectUri: string;
  scope: string;
  codeChallenge?: string | null;
  codeChallengeMethod?: string | null;
}): Promise<string> {
  const code = randomToken(32);
  await prisma.oAuthAuthCode.create({
    data: {
      codeHash: sha256(code),
      clientId: input.clientId,
      userId: input.userId,
      redirectUri: input.redirectUri,
      scope: input.scope,
      codeChallenge: input.codeChallenge ?? null,
      codeChallengeMethod: input.codeChallengeMethod ?? null,
      expiresAt: new Date(Date.now() + CODE_TTL_S * 1000),
    },
  });
  return code;
}

/** Consume (delete) an auth code and return it if still valid. */
export async function consumeAuthorizationCode(code: string) {
  const record = await prisma.oAuthAuthCode.findUnique({
    where: { codeHash: sha256(code) },
  });
  if (!record) return null;
  await prisma.oAuthAuthCode
    .delete({ where: { id: record.id } })
    .catch(() => {});
  if (record.expiresAt.getTime() < Date.now()) return null;
  return record;
}

export interface IssuedTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

/** Issue an access + refresh token pair. */
export async function issueTokens(input: {
  clientId: string;
  userId: string;
  scope: string;
}): Promise<IssuedTokens> {
  const accessToken = randomToken(32);
  const refreshToken = randomToken(32);
  await prisma.oAuthToken.create({
    data: {
      accessTokenHash: sha256(accessToken),
      refreshTokenHash: sha256(refreshToken),
      clientId: input.clientId,
      userId: input.userId,
      scope: input.scope,
      expiresAt: new Date(Date.now() + ACCESS_TTL_S * 1000),
      refreshExpiresAt: new Date(Date.now() + REFRESH_TTL_S * 1000),
    },
  });
  return { accessToken, refreshToken, expiresIn: ACCESS_TTL_S };
}

/** Rotate a refresh token for the same client. Returns new tokens or null. */
export async function rotateRefreshToken(
  refreshToken: string,
  clientId: string,
) {
  const record = await prisma.oAuthToken.findUnique({
    where: { refreshTokenHash: sha256(refreshToken) },
  });
  if (!record || record.clientId !== clientId) return null;
  if (
    record.refreshExpiresAt &&
    record.refreshExpiresAt.getTime() < Date.now()
  ) {
    return null;
  }
  await prisma.oAuthToken.delete({ where: { id: record.id } }).catch(() => {});
  return issueTokens({
    clientId,
    userId: record.userId,
    scope: record.scope,
  });
}

/** Resolve a Bearer access token to its user + scope, or null. */
export async function getTokenSubject(accessToken: string) {
  const record = await prisma.oAuthToken.findUnique({
    where: { accessTokenHash: sha256(accessToken) },
  });
  if (!record || record.expiresAt.getTime() < Date.now()) return null;
  const user = await prisma.user.findUnique({ where: { id: record.userId } });
  if (!user) return null;
  return { user, scope: record.scope };
}
