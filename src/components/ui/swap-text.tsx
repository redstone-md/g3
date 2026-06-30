"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Swaps its text in place when the value changes (transitions.dev
 * text-states-swap): the old label exits up with blur, the new one enters from
 * below. Faithful to the snippet's three phases, but React-safe — the content
 * swap is a state update and the "enter" phase runs in a layout effect (after
 * the DOM updates, before paint) so the reflow lands on the new text.
 */
export function SwapText({
  children,
  className,
}: {
  children: string;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [text, setText] = useState(children);
  const pendingEnter = useRef(false);

  // Incoming change → play the exit, then swap the content.
  useEffect(() => {
    if (children === text) return;
    const el = ref.current;
    if (!el) {
      setText(children);
      return;
    }
    const dur =
      Number.parseFloat(
        getComputedStyle(document.documentElement).getPropertyValue(
          "--text-swap-dur",
        ),
      ) || 150;
    el.classList.add("is-exit");
    const id = window.setTimeout(() => {
      pendingEnter.current = true;
      setText(children);
    }, dur);
    return () => window.clearTimeout(id);
  }, [children, text]);

  // After the new text is in the DOM, drop it below and release so it rises.
  useLayoutEffect(() => {
    if (!pendingEnter.current) return;
    pendingEnter.current = false;
    const el = ref.current;
    if (!el) return;
    el.classList.remove("is-exit");
    el.classList.add("is-enter-start");
    void el.offsetHeight; // force reflow so the release transitions
    el.classList.remove("is-enter-start");
  }, [text]);

  return (
    <span ref={ref} className={cn("t-text-swap", className)}>
      {text}
    </span>
  );
}
