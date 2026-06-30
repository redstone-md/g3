"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { SwapText } from "@/components/ui/swap-text";
import { useRoles } from "@/hooks/use-roles";
import { useCreateUser, useUpdateUser } from "@/hooks/use-users";
import type { UserDTO } from "@/lib/types";
import { useUserDialogStore } from "@/stores/use-user-dialog-store";

function UserForm({
  user,
  onDone,
}: {
  user: UserDTO | null;
  onDone: () => void;
}) {
  const t = useTranslations("users");
  const tc = useTranslations("common");
  const { data: roles } = useRoles();
  const [name, setName] = useState(user?.name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [roleIds, setRoleIds] = useState<Set<string>>(
    new Set(user?.roles.map((r) => r.id) ?? []),
  );
  const [password, setPassword] = useState("");

  const createUser = useCreateUser();
  const updateUser = useUpdateUser();
  const pending = createUser.isPending || updateUser.isPending;

  function toggleRole(id: string, on: boolean) {
    setRoleIds((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const ids = [...roleIds];
    try {
      if (user) {
        await updateUser.mutateAsync({
          id: user.id,
          input: { name: name.trim(), roleIds: ids, password: password || "" },
        });
      } else {
        await createUser.mutateAsync({
          email: email.trim(),
          name: name.trim(),
          password,
          roleIds: ids,
        });
      }
      onDone();
    } catch {
      /* surfaced via toast */
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex h-full flex-col">
      <div className="flex-1 space-y-5 overflow-y-auto px-4">
        <div className="grid gap-2">
          <Label htmlFor="user-email">{t("email")}</Label>
          <Input
            id="user-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t("emailPlaceholder")}
            disabled={!!user}
            required={!user}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="user-name">{t("name")}</Label>
          <Input
            id="user-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("namePlaceholder")}
          />
        </div>
        <div className="grid gap-2">
          <Label>{t("roles")}</Label>
          <div className="grid gap-2 rounded-lg border border-border/60 p-3">
            {roles?.length ? (
              roles.map((role) => (
                <label
                  key={role.id}
                  htmlFor={`role-${role.id}`}
                  className="flex cursor-pointer items-center gap-3 text-sm"
                >
                  <Checkbox
                    id={`role-${role.id}`}
                    checked={roleIds.has(role.id)}
                    onCheckedChange={(c) => toggleRole(role.id, c === true)}
                  />
                  {role.name}
                </label>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">{t("noRoles")}</p>
            )}
          </div>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="user-password">
            {user ? t("newPasswordOptional") : t("password")}
          </Label>
          <PasswordInput
            id="user-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={user ? t("passwordKeep") : t("passwordHint")}
            required={!user}
            strength
          />
        </div>
      </div>

      <SheetFooter>
        <Button type="submit" disabled={pending}>
          <SwapText>
            {pending ? tc("saving") : user ? tc("save") : t("createBtn")}
          </SwapText>
        </Button>
      </SheetFooter>
    </form>
  );
}

export function UserEditor() {
  const t = useTranslations("users");
  const open = useUserDialogStore((s) => s.open);
  const user = useUserDialogStore((s) => s.user);
  const close = useUserDialogStore((s) => s.close);

  return (
    <Sheet open={open} onOpenChange={(o) => !o && close()}>
      <SheetContent className="flex w-full flex-col gap-0 sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{user ? t("editTitle") : t("createTitle")}</SheetTitle>
          <SheetDescription>
            {user ? t("editSub") : t("createSub")}
          </SheetDescription>
        </SheetHeader>
        <UserForm key={user?.id ?? "new"} user={user} onDone={close} />
      </SheetContent>
    </Sheet>
  );
}
