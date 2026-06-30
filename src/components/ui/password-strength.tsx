"use client";

import { useTranslations } from "next-intl";
import { SwapText } from "@/components/ui/swap-text";
import { type StrengthLevel, scorePassword } from "@/lib/password-strength";
import { cn } from "@/lib/utils";

const SEGMENTS = [1, 2, 3, 4] as const;

const BAR_COLOR: Record<StrengthLevel, string> = {
  weak: "bg-destructive",
  fair: "bg-orange-500",
  good: "bg-yellow-500",
  strong: "bg-emerald-500",
};

const TEXT_COLOR: Record<StrengthLevel, string> = {
  weak: "text-destructive",
  fair: "text-orange-500",
  good: "text-yellow-600 dark:text-yellow-500",
  strong: "text-emerald-600 dark:text-emerald-500",
};

/**
 * Password strength meter: four segments fill by colour (transition-colors,
 * never width — no layout animation) and the level label swaps in place via
 * the text-states-swap. Renders nothing until something is typed.
 */
export function PasswordStrength({
  value,
  className,
}: {
  value: string;
  className?: string;
}) {
  const t = useTranslations("common");
  const result = scorePassword(value);

  return (
    <div className={cn("space-y-1.5", className)} aria-live="polite">
      <div className="flex gap-1.5">
        {SEGMENTS.map((seg) => (
          <span
            key={seg}
            className={cn(
              "h-1 flex-1 rounded-full transition-colors duration-300",
              result && seg <= result.score
                ? BAR_COLOR[result.level]
                : "bg-border",
            )}
          />
        ))}
      </div>
      {result ? (
        <p className={cn("text-xs", TEXT_COLOR[result.level])}>
          <SwapText>{t(`password_${result.level}`)}</SwapText>
        </p>
      ) : null}
    </div>
  );
}
