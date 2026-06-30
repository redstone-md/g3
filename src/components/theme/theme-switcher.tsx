"use client";

import { PaintBrushIcon, Tick02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { setTheme } from "@/lib/actions/theme";
import { applyThemeClass, THEMES } from "@/lib/themes";

export function ThemeSwitcher({ current }: { current: string }) {
  const t = useTranslations("settings");
  const router = useRouter();
  const [selected, setSelected] = useState(current);
  const [pending, startTransition] = useTransition();

  function pick(slug: string) {
    if (slug === selected) return;
    setSelected(slug); // optimistic
    applyThemeClass(slug); // instant repaint
    startTransition(async () => {
      await setTheme(slug); // persist to DB + cookie
      router.refresh();
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={t("changeTheme")}
          disabled={pending}
        >
          <HugeiconsIcon icon={PaintBrushIcon} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuLabel>{t("theme")}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {THEMES.map((theme) => (
          <DropdownMenuItem
            key={theme.slug}
            onSelect={() => pick(theme.slug)}
            className="justify-between"
          >
            {theme.label}
            {theme.slug === selected ? (
              <HugeiconsIcon icon={Tick02Icon} className="size-4 t-check-pop" />
            ) : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
