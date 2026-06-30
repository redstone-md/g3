/** Animation preset registry — client-safe. Cookie is SSR source; DB is truth. */

export const MOTION_PRESETS = ["smooth", "snappy", "none"] as const;
export type MotionPreset = (typeof MOTION_PRESETS)[number];

export const DEFAULT_MOTION: MotionPreset = "smooth";
export const MOTION_COOKIE = "ribbon_motion";

export const MOTION_LABELS: Record<MotionPreset, string> = {
  smooth: "Smooth",
  snappy: "Snappy",
  none: "None",
};

export function isMotion(
  value: string | undefined | null,
): value is MotionPreset {
  return !!value && (MOTION_PRESETS as readonly string[]).includes(value);
}

export function resolveMotion(value: string | undefined | null): MotionPreset {
  return isMotion(value) ? value : DEFAULT_MOTION;
}

export function motionClass(value: string | undefined | null): string {
  return `motion-${resolveMotion(value)}`;
}

/** Client-only: swap the `motion-*` class on <html> for an instant preview. */
export function applyMotionClass(value: string): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.classList.forEach((c) => {
    if (c.startsWith("motion-")) root.classList.remove(c);
  });
  root.classList.add(motionClass(value));
}
