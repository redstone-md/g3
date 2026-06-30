/** Theme registry — client-safe (no server-only). Values match src/app/themes.css. */

export interface ThemeDef {
  slug: string;
  label: string;
}

export const THEMES: readonly ThemeDef[] = [
  { slug: "modern-minimal", label: "Modern Minimal" },
  { slug: "amber-minimal", label: "Amber Minimal" },
  { slug: "amethyst-haze", label: "Amethyst Haze" },
  { slug: "caffeine", label: "Caffeine" },
  { slug: "claude", label: "Claude" },
  { slug: "darkmatter", label: "Darkmatter" },
  { slug: "graphite", label: "Graphite" },
  { slug: "northern-lights", label: "Northern Lights" },
  { slug: "sage-garden", label: "Sage Garden" },
  { slug: "supabase", label: "Supabase" },
  { slug: "tangerine", label: "Tangerine" },
  { slug: "vercel", label: "Vercel" },
  { slug: "twitter", label: "Twitter" },
] as const;

export const DEFAULT_THEME = "modern-minimal";

const SLUGS = new Set(THEMES.map((t) => t.slug));

export function isValidTheme(slug: string | undefined | null): boolean {
  return !!slug && SLUGS.has(slug);
}

/** Normalize an arbitrary value to a known theme slug. */
export function resolveTheme(slug: string | undefined | null): string {
  return isValidTheme(slug) ? (slug as string) : DEFAULT_THEME;
}

export function themeClass(slug: string): string {
  return `theme-${resolveTheme(slug)}`;
}

/** Client-only: swap the `theme-*` class on <html> for an instant preview. */
export function applyThemeClass(slug: string): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.classList.forEach((c) => {
    if (c.startsWith("theme-")) root.classList.remove(c);
  });
  root.classList.add(themeClass(slug));
}
