import { describe, expect, it } from "vitest";
import { scorePassword } from "@/lib/password-strength";

describe("password strength", () => {
  it("returns null for an empty password", () => {
    expect(scorePassword("")).toBeNull();
  });

  it("caps short passwords at weak even with variety", () => {
    // 7 chars, all classes — variety can't beat the length cap.
    expect(scorePassword("aB3$xY!")).toEqual({ score: 1, level: "weak" });
  });

  it("rates a long mixed password as strong", () => {
    expect(scorePassword("Str0ng&Secure!")).toEqual({
      score: 4,
      level: "strong",
    });
  });

  it("rates a plain medium-length password in between", () => {
    const result = scorePassword("password1");
    expect(result?.score).toBeGreaterThanOrEqual(2);
    expect(result?.score).toBeLessThan(4);
  });

  it("never reports a level out of the 1–4 range", () => {
    for (const pw of ["a", "aaaaaaaa", "Aa1!Aa1!Aa1!", "x".repeat(40)]) {
      const result = scorePassword(pw);
      expect(result).not.toBeNull();
      expect(result?.score).toBeGreaterThanOrEqual(1);
      expect(result?.score).toBeLessThanOrEqual(4);
    }
  });
});
