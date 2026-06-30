import { type AvatarDef, getAvatar } from "@/lib/avatars";
import { cn } from "@/lib/utils";

function Glyph({ def }: { def: AvatarDef }) {
  const { fg, variant } = def;
  switch (variant) {
    case 0:
      return <circle cx="40" cy="40" r="20" fill={fg} />;
    case 1:
      return (
        <>
          <circle cx="40" cy="30" r="13" fill={fg} />
          <circle cx="40" cy="56" r="18" fill={fg} />
        </>
      );
    case 2:
      return <path d="M40 20 L62 60 L18 60 Z" fill={fg} />;
    case 3:
      return (
        <>
          <rect x="18" y="18" width="20" height="20" rx="4" fill={fg} />
          <rect x="42" y="42" width="20" height="20" rx="4" fill={fg} />
        </>
      );
    case 4:
      return (
        <circle
          cx="40"
          cy="40"
          r="18"
          fill="none"
          stroke={fg}
          strokeWidth="7"
        />
      );
    default:
      return (
        <>
          <circle cx="30" cy="30" r="7" fill={fg} />
          <circle cx="50" cy="30" r="7" fill={fg} />
          <circle cx="30" cy="50" r="7" fill={fg} />
          <circle cx="50" cy="50" r="7" fill={fg} />
        </>
      );
  }
}

/** Renders a preset avatar SVG, or nothing when the key is unknown. */
export function PresetAvatar({
  avatarKey,
  className,
}: {
  avatarKey: string | null | undefined;
  className?: string;
}) {
  const def = getAvatar(avatarKey);
  if (!def) return null;
  const [from, to] = def.bg.split(",");
  const gradientId = `grad-${def.key}`;

  return (
    <svg
      viewBox="0 0 80 80"
      className={cn("size-full rounded-full", className)}
      role="img"
      aria-hidden
    >
      <title>Avatar</title>
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={from} />
          <stop offset="100%" stopColor={to} />
        </linearGradient>
      </defs>
      <rect width="80" height="80" fill={`url(#${gradientId})`} />
      <Glyph def={def} />
    </svg>
  );
}
