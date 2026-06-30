import { type NextRequest, NextResponse } from "next/server";
import { verifyPkce } from "@/lib/oauth/crypto";
import {
  authenticateClient,
  consumeAuthorizationCode,
  issueTokens,
  rotateRefreshToken,
} from "@/lib/oauth/server";

function err(error: string, description?: string, status = 400) {
  return NextResponse.json(
    { error, error_description: description },
    { status },
  );
}

/** Parse client credentials from HTTP Basic auth or the request body. */
function clientCreds(request: NextRequest, body: URLSearchParams) {
  const auth = request.headers.get("authorization");
  if (auth?.startsWith("Basic ")) {
    const [id, secret] = Buffer.from(auth.slice(6), "base64")
      .toString()
      .split(":");
    return { clientId: id, clientSecret: secret };
  }
  return {
    clientId: body.get("client_id") ?? "",
    clientSecret: body.get("client_secret") ?? undefined,
  };
}

export async function POST(request: NextRequest) {
  const raw = await request.text();
  const body = new URLSearchParams(raw);
  const grantType = body.get("grant_type");
  const { clientId, clientSecret } = clientCreds(request, body);

  if (!clientId) return err("invalid_request", "Missing client_id");
  const client = await authenticateClient(clientId, clientSecret);
  if (!client)
    return err("invalid_client", "Client authentication failed", 401);

  if (grantType === "authorization_code") {
    const code = body.get("code") ?? "";
    const redirectUri = body.get("redirect_uri") ?? "";
    const verifier = body.get("code_verifier") ?? "";

    const record = await consumeAuthorizationCode(code);
    if (!record || record.clientId !== clientId) {
      return err("invalid_grant", "Invalid or expired code");
    }
    if (record.redirectUri !== redirectUri) {
      return err("invalid_grant", "redirect_uri mismatch");
    }
    if (record.codeChallenge) {
      if (
        !verifier ||
        !verifyPkce(verifier, record.codeChallenge, record.codeChallengeMethod)
      ) {
        return err("invalid_grant", "PKCE verification failed");
      }
    } else if (client.isPublic) {
      return err("invalid_grant", "PKCE required for public clients");
    }

    const tokens = await issueTokens({
      clientId,
      userId: record.userId,
      scope: record.scope,
    });
    return tokenResponse(tokens, record.scope);
  }

  if (grantType === "refresh_token") {
    const refreshToken = body.get("refresh_token") ?? "";
    const tokens = await rotateRefreshToken(refreshToken, clientId);
    if (!tokens)
      return err("invalid_grant", "Invalid or expired refresh token");
    return tokenResponse(tokens);
  }

  return err("unsupported_grant_type", `Unsupported grant_type: ${grantType}`);
}

function tokenResponse(
  tokens: { accessToken: string; refreshToken: string; expiresIn: number },
  scope?: string,
) {
  return NextResponse.json(
    {
      access_token: tokens.accessToken,
      token_type: "Bearer",
      expires_in: tokens.expiresIn,
      refresh_token: tokens.refreshToken,
      ...(scope ? { scope } : {}),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
