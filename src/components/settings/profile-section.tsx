"use client";

import { Tick02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { PresetAvatar } from "@/components/avatar/preset-avatar";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateProfile } from "@/lib/actions/profile";
import { AVATARS } from "@/lib/avatars";
import { cn } from "@/lib/utils";

interface ProfileSectionProps {
  name: string | null;
  avatar: string | null;
  email: string;
}

export function ProfileSection({
  name: dName,
  avatar: dAvatar,
  email,
}: ProfileSectionProps) {
  const t = useTranslations("settings");
  const tc = useTranslations("common");
  const router = useRouter();
  const [name, setName] = useState(dName ?? "");
  const [avatar, setAvatar] = useState<string | null>(dAvatar);
  const [pending, startTransition] = useTransition();

  function save() {
    startTransition(async () => {
      const res = await updateProfile({ name: name.trim(), avatar });
      if (res.ok) {
        toast.success(t("profileUpdated"));
        router.refresh();
      } else {
        toast.error(res.error ?? "Could not save.");
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("profile")}</CardTitle>
        <CardDescription>{t("profileDescription", { email })}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid max-w-sm gap-2">
          <Label htmlFor="profile-name">{t("displayName")}</Label>
          <Input
            id="profile-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("namePlaceholder")}
          />
        </div>

        <div className="space-y-3">
          <Label>{t("avatar")}</Label>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => setAvatar(null)}
              className={cn(
                "flex size-12 items-center justify-center rounded-full border-2 bg-muted text-xs font-medium text-muted-foreground transition",
                avatar === null ? "border-primary" : "border-transparent",
              )}
              aria-label={t("noAvatar")}
            >
              {tc("none")}
            </button>
            {AVATARS.map((a) => (
              <button
                key={a.key}
                type="button"
                onClick={() => setAvatar(a.key)}
                className={cn(
                  "relative size-12 overflow-hidden rounded-full border-2 transition",
                  avatar === a.key ? "border-primary" : "border-transparent",
                )}
                aria-label={t("avatarAria", { key: a.key })}
              >
                <PresetAvatar avatarKey={a.key} />
                {avatar === a.key ? (
                  <span className="absolute inset-0 flex items-center justify-center bg-black/30">
                    <HugeiconsIcon
                      icon={Tick02Icon}
                      className="size-5 text-white t-check-pop"
                    />
                  </span>
                ) : null}
              </button>
            ))}
          </div>
        </div>

        <Button onClick={save} disabled={pending}>
          {pending ? tc("saving") : t("saveProfile")}
        </Button>
      </CardContent>
    </Card>
  );
}
