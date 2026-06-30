"use client";

import { Copy01Icon, Tick02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Copy-to-clipboard button. The copy icon cross-fades to a checkmark on success
 * (transitions.dev icon-swap, `.t-icon-swap`) and reverts after a short hold.
 * Encapsulated so every copy affordance shares one behaviour + one animation.
 */
export function CopyButton({
  value,
  label,
  className,
  onCopied,
}: {
  value: string;
  /** Accessible label (the button is icon-only). */
  label: string;
  className?: string;
  /** Fired after a successful copy (e.g. to raise a toast). */
  onCopied?: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  function copy() {
    void navigator.clipboard.writeText(value);
    setCopied(true);
    onCopied?.();
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="icon-sm"
      aria-label={label}
      onClick={copy}
      className={className}
    >
      <span className="t-icon-swap" data-state={copied ? "b" : "a"}>
        <span className="t-icon" data-icon="a">
          <HugeiconsIcon icon={Copy01Icon} className={cn("size-4")} />
        </span>
        <span className="t-icon text-primary" data-icon="b">
          <HugeiconsIcon icon={Tick02Icon} className={cn("size-4")} />
        </span>
      </span>
    </Button>
  );
}
