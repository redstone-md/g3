"use client";

import {
  KeyIcon,
  Logout01Icon,
  Settings01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { PresetAvatar } from "@/components/avatar/preset-avatar";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { logout } from "@/lib/actions/auth";
import { isValidAvatar } from "@/lib/avatars";

interface UserMenuProps {
  name: string | null;
  email: string;
  avatar: string | null;
  roleName: string | null;
}

function initials(name: string | null, email: string): string {
  const source = name?.trim() || email;
  const parts = source.split(/[\s@.]+/).filter(Boolean);
  return (parts[0]?.[0] ?? "?").concat(parts[1]?.[0] ?? "").toUpperCase();
}

export function UserMenu({ name, email, avatar, roleName }: UserMenuProps) {
  const t = useTranslations("userMenu");
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-9 gap-2 px-1.5">
          <Avatar className="size-7">
            {isValidAvatar(avatar) ? (
              <PresetAvatar avatarKey={avatar} />
            ) : (
              <AvatarFallback className="bg-primary/15 text-xs font-medium text-primary">
                {initials(name, email)}
              </AvatarFallback>
            )}
          </Avatar>
          <span className="hidden text-sm font-medium sm:inline-block">
            {name || email}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="flex flex-col gap-0.5">
          <span className="truncate text-sm font-medium">
            {name || t("account")}
          </span>
          <span className="truncate text-xs font-normal text-muted-foreground">
            {email}
          </span>
          {roleName ? (
            <span className="mt-1 text-xs font-normal text-muted-foreground">
              {t("role", { roles: roleName })}
            </span>
          ) : null}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/dashboard/settings">
            <HugeiconsIcon icon={Settings01Icon} />
            {t("settings")}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/account/password">
            <HugeiconsIcon icon={KeyIcon} />
            {t("changePassword")}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <form action={logout}>
          <DropdownMenuItem asChild>
            <button type="submit" className="w-full">
              <HugeiconsIcon icon={Logout01Icon} />
              {t("signOut")}
            </button>
          </DropdownMenuItem>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
