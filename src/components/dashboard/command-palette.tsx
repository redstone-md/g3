"use client";

import {
  KeyIcon,
  Logout01Icon,
  PaintBrushIcon,
  Settings01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect } from "react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { logout } from "@/lib/actions/auth";
import { setTheme } from "@/lib/actions/theme";
import { NAV_ITEMS } from "@/lib/nav";
import { applyThemeClass, THEMES } from "@/lib/themes";
import { useCommandStore } from "@/stores/use-command-store";

export function CommandPalette({ permissions }: { permissions: string[] }) {
  const router = useRouter();
  const tc = useTranslations("command");
  const tNav = useTranslations("nav");
  const tm = useTranslations("userMenu");
  const tCommon = useTranslations("common");
  const open = useCommandStore((s) => s.open);
  const setOpen = useCommandStore((s) => s.setOpen);
  const toggle = useCommandStore((s) => s.toggle);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        toggle();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [toggle]);

  const navItems = NAV_ITEMS.filter((i) => permissions.includes(i.permission));

  function go(href: string) {
    setOpen(false);
    router.push(href);
  }

  function pickTheme(slug: string) {
    setOpen(false);
    applyThemeClass(slug);
    void setTheme(slug).then(() => router.refresh());
  }

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder={tc("placeholder")} />
      <CommandList>
        <CommandEmpty>{tCommon("noResults")}</CommandEmpty>
        <CommandGroup heading={tc("navigation")}>
          {navItems.map((item) => (
            <CommandItem key={item.href} onSelect={() => go(item.href)}>
              <HugeiconsIcon icon={item.icon} />
              {tNav(item.titleKey)}
            </CommandItem>
          ))}
          <CommandItem onSelect={() => go("/dashboard/settings")}>
            <HugeiconsIcon icon={Settings01Icon} />
            {tm("settings")}
          </CommandItem>
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading={tc("theme")}>
          {THEMES.map((theme) => (
            <CommandItem
              key={theme.slug}
              value={`theme ${theme.label}`}
              onSelect={() => pickTheme(theme.slug)}
            >
              <HugeiconsIcon icon={PaintBrushIcon} />
              {theme.label}
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading={tc("account")}>
          <CommandItem onSelect={() => go("/account/password")}>
            <HugeiconsIcon icon={KeyIcon} />
            {tm("changePassword")}
          </CommandItem>
          <CommandItem
            onSelect={() => {
              setOpen(false);
              void logout();
            }}
          >
            <HugeiconsIcon icon={Logout01Icon} />
            {tm("signOut")}
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
