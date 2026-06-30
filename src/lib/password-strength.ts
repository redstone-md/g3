/** Lightweight, dependency-free password strength heuristic (client-safe). */

export type StrengthLevel = "weak" | "fair" | "good" | "strong";

export interface Strength {
  /** 1–4, aligned to the four meter segments. */
  score: 1 | 2 | 3 | 4;
  level: StrengthLevel;
}

const LEVELS = ["weak", "fair", "good", "strong"] as const;

/**
 * Scores a password on length + character-class variety. Returns null for an
 * empty string (nothing to show yet). Short passwords are capped at "weak" so
 * variety alone can't fake strength.
 */
export function scorePassword(password: string): Strength | null {
  if (!password) return null;

  let raw = 0;
  if (password.length >= 8) raw++;
  if (password.length >= 12) raw++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) raw++;
  if (/\d/.test(password)) raw++;
  if (/[^A-Za-z0-9]/.test(password)) raw++;
  if (password.length < 8) raw = Math.min(raw, 1);

  const score = Math.max(1, Math.min(4, raw)) as Strength["score"];
  return { score, level: LEVELS[score - 1] };
}
