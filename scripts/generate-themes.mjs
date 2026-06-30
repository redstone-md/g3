// Regenerates src/app/themes.css from the tweakcn registry.
// Usage: node scripts/generate-themes.mjs
// Each theme is emitted as its dark-mode tokens, scoped to `.dark.theme-<slug>`
// so it overrides the base `.dark` block. Font tokens are intentionally skipped
// so the app keeps its next/font (Figtree / Geist Mono) loading.
import { writeFileSync } from "node:fs";

export const THEMES = [
  ["amber-minimal", "Amber Minimal"],
  ["amethyst-haze", "Amethyst Haze"],
  ["caffeine", "Caffeine"],
  ["claude", "Claude"],
  ["darkmatter", "Darkmatter"],
  ["graphite", "Graphite"],
  ["modern-minimal", "Modern Minimal"],
  ["northern-lights", "Northern Lights"],
  ["sage-garden", "Sage Garden"],
  ["supabase", "Supabase"],
  ["tangerine", "Tangerine"],
  ["vercel", "Vercel"],
  ["twitter", "Twitter"],
];

const KEYS = [
  "background",
  "foreground",
  "card",
  "card-foreground",
  "popover",
  "popover-foreground",
  "primary",
  "primary-foreground",
  "secondary",
  "secondary-foreground",
  "muted",
  "muted-foreground",
  "accent",
  "accent-foreground",
  "destructive",
  "destructive-foreground",
  "border",
  "input",
  "ring",
  "chart-1",
  "chart-2",
  "chart-3",
  "chart-4",
  "chart-5",
  "radius",
  "sidebar",
  "sidebar-foreground",
  "sidebar-primary",
  "sidebar-primary-foreground",
  "sidebar-accent",
  "sidebar-accent-foreground",
  "sidebar-border",
  "sidebar-ring",
];

async function main() {
  let out =
    "/* GENERATED from tweakcn (https://tweakcn.com) — do not edit by hand. */\n";
  out += "/* Regenerate via: node scripts/generate-themes.mjs */\n\n";

  for (const [slug] of THEMES) {
    const res = await fetch(`https://tweakcn.com/r/themes/${slug}.json`);
    if (!res.ok) throw new Error(`${slug}: HTTP ${res.status}`);
    const json = await res.json();
    const dark = json.cssVars?.dark ?? {};
    const lines = KEYS.filter((k) => dark[k] != null)
      .map((k) => `  --${k}: ${dark[k]};`)
      .join("\n");
    out += `.dark.theme-${slug} {\n${lines}\n}\n\n`;
  }

  writeFileSync(new URL("../src/app/themes.css", import.meta.url), out);
  console.log(`wrote src/app/themes.css — ${THEMES.length} themes`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
