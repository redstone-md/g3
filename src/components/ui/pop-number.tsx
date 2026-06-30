"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

/**
 * Animated number. Each character re-enters with a blurred slide whenever the
 * value changes (transitions.dev number-pop-in, `.t-digit-group`). The very
 * first paint is silent — only genuine updates replay — so it never collides
 * with the page-enter animation. The last two characters stagger.
 */
export function PopNumber({
  value,
  className,
}: {
  value: number | string;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const prev = useRef<string | null>(null);
  const str = String(value);
  const chars = str.split("");

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Skip the mount paint; animate only on a real value change.
    if (prev.current === null || prev.current === str) {
      prev.current = str;
      return;
    }
    prev.current = str;
    el.classList.remove("is-animating");
    void el.offsetWidth; // force reflow so the animation replays
    el.classList.add("is-animating");
  }, [str]);

  return (
    <span ref={ref} className={cn("t-digit-group", className)}>
      {chars.map((ch, i) => (
        <span
          // index key is intentional: positional digit slots, not entities
          key={i}
          className="t-digit"
          data-stagger={
            i === chars.length - 2
              ? "1"
              : i === chars.length - 1
                ? "2"
                : undefined
          }
        >
          {ch}
        </span>
      ))}
    </span>
  );
}
