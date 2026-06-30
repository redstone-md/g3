import { describe, expect, it } from "vitest";
import { pkceChallenge, randomToken, verifyPkce } from "@/lib/oauth/crypto";

describe("PKCE", () => {
  it("S256 challenge verifies its own verifier", () => {
    const verifier = randomToken(32);
    const challenge = pkceChallenge(verifier);
    expect(verifyPkce(verifier, challenge, "S256")).toBe(true);
  });

  it("rejects a wrong verifier", () => {
    const challenge = pkceChallenge(randomToken(32));
    expect(verifyPkce(randomToken(32), challenge, "S256")).toBe(false);
  });

  it("rejects when no challenge stored", () => {
    expect(verifyPkce("anything", null, "S256")).toBe(false);
  });

  it("supports the plain method", () => {
    expect(verifyPkce("abc", "abc", "plain")).toBe(true);
    expect(verifyPkce("abc", "xyz", "plain")).toBe(false);
  });
});
