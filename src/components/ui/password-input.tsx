"use client";

import { ViewIcon, ViewOffIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useTranslations } from "next-intl";
import type * as React from "react";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { PasswordStrength } from "@/components/ui/password-strength";
import { cn } from "@/lib/utils";

/**
 * Password field with a show/hide toggle. The eye icon cross-fades to a
 * struck-through eye via the transitions.dev icon-swap (`.t-icon-swap`).
 * Forwards every Input prop except `type`, which it owns. Pass `strength` to
 * render a live strength meter below the field (works for controlled and
 * uncontrolled inputs — the value is mirrored internally for scoring).
 */
export function PasswordInput({
  className,
  strength = false,
  onChange,
  ...props
}: Omit<React.ComponentProps<typeof Input>, "type"> & {
  strength?: boolean;
}) {
  const t = useTranslations("common");
  const [show, setShow] = useState(false);
  const [internal, setInternal] = useState("");
  const pw = typeof props.value === "string" ? props.value : internal;

  function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    setInternal(event.target.value);
    onChange?.(event);
  }

  return (
    <div className="grid gap-2">
      <div className="relative">
        <Input
          type={show ? "text" : "password"}
          className={cn("pr-10", className)}
          onChange={handleChange}
          {...props}
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          aria-label={show ? t("hidePassword") : t("showPassword")}
          tabIndex={-1}
          className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground transition-colors hover:text-foreground"
        >
          <span className="t-icon-swap" data-state={show ? "b" : "a"}>
            <span className="t-icon" data-icon="a">
              <HugeiconsIcon icon={ViewIcon} className="size-4" />
            </span>
            <span className="t-icon" data-icon="b">
              <HugeiconsIcon icon={ViewOffIcon} className="size-4" />
            </span>
          </span>
        </button>
      </div>
      {strength ? <PasswordStrength value={pw} /> : null}
    </div>
  );
}
