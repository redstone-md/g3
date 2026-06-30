import "server-only";
import crypto from "node:crypto";

/** Token lifetimes for the OAuth provider. */
export const ACCESS_TTL_S = 60 * 60; // 1 hour
export const REFRESH_TTL_S = 30 * 24 * 60 * 60; // 30 days
export const CODE_TTL_S = 10 * 60; // 10 minutes

export function sha256(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex");
}

export function randomToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString("hex");
}

export function base64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url");
}

/** Constant-time equality for two hex digests. */
export function safeEqualHex(a: string, b: string): boolean {
  const ab = Buffer.from(a, "hex");
  const bb = Buffer.from(b, "hex");
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

/** Compute the S256 PKCE challenge for a verifier (client side). */
export function pkceChallenge(verifier: string): string {
  return crypto.createHash("sha256").update(verifier).digest("base64url");
}

/** Verify a PKCE code_verifier against the stored challenge. */
export function verifyPkce(
  verifier: string,
  challenge: string | null | undefined,
  method: string | null | undefined,
): boolean {
  if (!challenge) return false;
  if (method === "S256" || !method) {
    const computed = crypto
      .createHash("sha256")
      .update(verifier)
      .digest("base64url");
    return computed === challenge;
  }
  // "plain"
  return verifier === challenge;
}
