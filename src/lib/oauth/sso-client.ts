import "server-only";
import { pkceChallenge, randomToken } from "@/lib/oauth/crypto";

/**
 * Generic OAuth2 (code + PKCE) client for "Sign in with SSO". Point it at a
 * Ribbon provider (or any compatible OAuth2 server) via env vars. A child app
 * built from this boilerplate uses this to authenticate against the main app.
 */

const ISSUER = process.env.SSO_ISSUER;
const CLIENT_ID = process.env.SSO_CLIENT_ID;
const CLIENT_SECRET = process.env.SSO_CLIENT_SECRET;
const REDIRECT_URI = process.env.SSO_REDIRECT_URI;
const SCOPES = process.env.SSO_SCOPES ?? "openid profile email";

export function isSsoConfigured(): boolean {
  return Boolean(ISSUER && CLIENT_ID && REDIRECT_URI);
}

export function ssoConfig() {
  if (!isSsoConfigured()) throw new Error("SSO is not configured.");
  return {
    issuer: ISSUER as string,
    clientId: CLIENT_ID as string,
    clientSecret: CLIENT_SECRET,
    redirectUri: REDIRECT_URI as string,
    scopes: SCOPES,
  };
}

/** Build the provider authorize URL + the PKCE verifier and state to persist. */
export function buildAuthorizeUrl() {
  const cfg = ssoConfig();
  const verifier = randomToken(32);
  const state = randomToken(16);
  const url = new URL(`${cfg.issuer.replace(/\/$/, "")}/oauth/authorize`);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", cfg.clientId);
  url.searchParams.set("redirect_uri", cfg.redirectUri);
  url.searchParams.set("scope", cfg.scopes);
  url.searchParams.set("state", state);
  url.searchParams.set("code_challenge", pkceChallenge(verifier));
  url.searchParams.set("code_challenge_method", "S256");
  return { url: url.toString(), verifier, state };
}

interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in?: number;
  refresh_token?: string;
}

export async function exchangeCode(
  code: string,
  verifier: string,
): Promise<TokenResponse> {
  const cfg = ssoConfig();
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: cfg.redirectUri,
    client_id: cfg.clientId,
    code_verifier: verifier,
  });
  if (cfg.clientSecret) body.set("client_secret", cfg.clientSecret);

  const res = await fetch(`${cfg.issuer.replace(/\/$/, "")}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Token exchange failed (${res.status}).`);
  return res.json();
}

export interface SsoUserinfo {
  sub: string;
  email?: string;
  name?: string | null;
  picture?: string | null;
}

export async function fetchUserinfo(accessToken: string): Promise<SsoUserinfo> {
  const cfg = ssoConfig();
  const res = await fetch(`${cfg.issuer.replace(/\/$/, "")}/oauth/userinfo`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Userinfo failed (${res.status}).`);
  return res.json();
}
