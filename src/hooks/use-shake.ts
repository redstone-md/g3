import { useEffect, useRef } from "react";

/**
 * transitions.dev error-shake driver. Returns a ref to attach to the element
 * carrying `.t-input`; whenever `trigger` changes to a truthy value the shake
 * replays (remove class → reflow → re-add). Respects prefers-reduced-motion
 * via the CSS guard.
 */
export function useShake<T extends HTMLElement = HTMLElement>(
  trigger: unknown,
) {
  const ref = useRef<T>(null);

  useEffect(() => {
    if (!trigger) return;
    const el = ref.current;
    if (!el) return;
    el.classList.remove("is-shaking");
    void el.offsetWidth; // force reflow so the animation replays
    el.classList.add("is-shaking");
    const t = window.setTimeout(() => el.classList.remove("is-shaking"), 320);
    return () => window.clearTimeout(t);
  }, [trigger]);

  return ref;
}
