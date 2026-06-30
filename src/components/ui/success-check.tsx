"use client";

import { useLayoutEffect, useRef } from "react";
import { cn } from "@/lib/utils";

/**
 * Animated success checkmark (transitions.dev success-check): on mount it fades
 * in, rotates upright, settles with a Y-bob and draws its stroke. Appear-only —
 * mount it when the success moment happens (e.g. inside a dialog shown on a
 * completed action). The stroke length is measured at runtime so the draw is
 * exact for the path below.
 */
export function SuccessCheck({ className }: { className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const path = el.querySelector("path");
    if (path) {
      const len = Math.ceil(path.getTotalLength());
      path.style.strokeDasharray = String(len);
      path.style.strokeDashoffset = String(len);
    }
    void el.offsetWidth; // reflow so the keyframes start from offset 0
    el.setAttribute("data-state", "in");
  }, []);

  return (
    <span
      ref={ref}
      className={cn("t-success-check text-primary", className)}
      data-state="out"
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 48 48"
        fill="none"
        className="size-full"
        aria-hidden="true"
      >
        <title>Success</title>
        <circle
          cx="24"
          cy="24"
          r="22"
          stroke="currentColor"
          strokeWidth="3"
          opacity="0.2"
        />
        <path
          d="M14 25l7 7 13-15"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}
