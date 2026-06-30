"use server";

import { redirect } from "next/navigation";
import { verifySession } from "@/lib/dal";
import {
  createAuthorizationCode,
  getClient,
  redirectUriAllowed,
} from "@/lib/oauth/server";

export interface ConsentParams {
  clientId: string;
  redirectUri: string;
  scope: string;
  state?: string;
  codeChallenge?: string;
  codeChallengeMethod?: string;
}

function redirectBack(uri: string, params: Record<string, string | undefined>) {
  const url = new URL(uri);
  for (const [k, v] of Object.entries(params))
    if (v) url.searchParams.set(k, v);
  redirect(url.toString());
}

/** User approved — mint an auth code and redirect back to the client. */
export async function approveAuthorization(p: ConsentParams): Promise<void> {
  const user = await verifySession();
  const client = await getClient(p.clientId);
  if (!client || !redirectUriAllowed(client, p.redirectUri)) {
    throw new Error("Invalid client or redirect URI.");
  }
  const code = await createAuthorizationCode({
    clientId: p.clientId,
    userId: user.id,
    redirectUri: p.redirectUri,
    scope: p.scope,
    codeChallenge: p.codeChallenge,
    codeChallengeMethod: p.codeChallengeMethod,
  });
  redirectBack(p.redirectUri, { code, state: p.state });
}

/** User denied — bounce back with an OAuth error. */
export async function denyAuthorization(p: ConsentParams): Promise<void> {
  await verifySession();
  const client = await getClient(p.clientId);
  if (!client || !redirectUriAllowed(client, p.redirectUri)) {
    throw new Error("Invalid client or redirect URI.");
  }
  redirectBack(p.redirectUri, { error: "access_denied", state: p.state });
}
