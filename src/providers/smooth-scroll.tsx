"use client";

import { ReactLenis, useLenis } from "lenis/react";
import "lenis/dist/lenis.css";
import { usePathname } from "next/navigation";
import { useEffect } from "react";

/**
 * Re-measures Lenis after each navigation. `root` Lenis caches the scroll
 * dimensions, so when a route change swaps content of a different height the
 * wheel gets intercepted but nothing scrolls until a native scrollbar drag
 * forces a resync. Resizing on pathname change (next frame + a short follow-up
 * for late layout/data) keeps the wheel working.
 */
function LenisRecalc() {
  const lenis = useLenis();
  const pathname = usePathname();

  // pathname is the navigation trigger — recalc on every route change even
  // though it isn't read inside the effect body.
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional trigger
  useEffect(() => {
    if (!lenis) return;
    const raf = requestAnimationFrame(() => lenis.resize());
    const timer = window.setTimeout(() => lenis.resize(), 300);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(timer);
    };
  }, [lenis, pathname]);

  return null;
}

/**
 * Global inertia smooth-scrolling (project-mandated, AGENTS §4.1).
 * `root` binds Lenis to the document scroller; `allowNestedScroll` keeps Radix
 * scroll areas and the sidebar usable.
 */
export function SmoothScroll({ children }: { children: React.ReactNode }) {
  return (
    <ReactLenis
      root
      options={{
        lerp: 0.1,
        smoothWheel: true,
        allowNestedScroll: true,
        anchors: true,
      }}
    >
      <LenisRecalc />
      {children}
    </ReactLenis>
  );
}
