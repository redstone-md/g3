/** Preset avatar catalog — client-safe. Users pick one; no uploads. */

export interface AvatarDef {
  key: string;
  bg: string; // gradient stops "from,to"
  fg: string;
  variant: number; // 0–5, selects the glyph shape
}

const PALETTE: [string, string, string][] = [
  ["#6366f1", "#8b5cf6", "#ffffff"],
  ["#06b6d4", "#3b82f6", "#ffffff"],
  ["#f59e0b", "#ef4444", "#ffffff"],
  ["#10b981", "#14b8a6", "#ffffff"],
  ["#ec4899", "#f43f5e", "#ffffff"],
  ["#8b5cf6", "#d946ef", "#ffffff"],
  ["#0ea5e9", "#22d3ee", "#0b1120"],
  ["#84cc16", "#22c55e", "#0b1120"],
  ["#f97316", "#f59e0b", "#0b1120"],
  ["#64748b", "#94a3b8", "#0b1120"],
  ["#a855f7", "#6366f1", "#ffffff"],
  ["#e11d48", "#fb7185", "#ffffff"],
];

export const AVATARS: AvatarDef[] = PALETTE.map(([from, to, fg], i) => ({
  key: `a${i + 1}`,
  bg: `${from},${to}`,
  fg,
  variant: i % 6,
}));

const BY_KEY = new Map(AVATARS.map((a) => [a.key, a]));

export function getAvatar(
  key: string | null | undefined,
): AvatarDef | undefined {
  return key ? BY_KEY.get(key) : undefined;
}

export function isValidAvatar(key: string | null | undefined): boolean {
  return !!key && BY_KEY.has(key);
}
