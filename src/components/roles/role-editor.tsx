"use client";

import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { SwapText } from "@/components/ui/swap-text";
import { useCreateRole, useRoles, useUpdateRole } from "@/hooks/use-roles";
import { PERMISSION_GROUPS } from "@/lib/permissions";
import { effectivePermissions, toRoleMap } from "@/lib/role-permissions";
import type { RoleDTO } from "@/lib/types";
import { useRoleDialogStore } from "@/stores/use-role-dialog-store";

function RoleForm({
  role,
  onDone,
}: {
  role: RoleDTO | null;
  onDone: () => void;
}) {
  const t = useTranslations("roles");
  const tc = useTranslations("common");
  const tp = useTranslations("permissions");
  const [name, setName] = useState(role?.name ?? "");
  const [description, setDescription] = useState(role?.description ?? "");
  const [permissions, setPermissions] = useState<Set<string>>(
    new Set(role?.permissions ?? []),
  );
  const [parentIds, setParentIds] = useState<Set<string>>(
    new Set(role?.parentIds ?? []),
  );

  const { data: allRoles } = useRoles();
  const createRole = useCreateRole();
  const updateRole = useUpdateRole();
  const pending = createRole.isPending || updateRole.isPending;

  // Roles selectable as parents (everything but this one).
  const parentOptions = (allRoles ?? []).filter((r) => r.id !== role?.id);

  // Permissions inherited from the currently-selected parents (locked on).
  const inherited = useMemo(() => {
    const map = toRoleMap(
      (allRoles ?? []).map((r) => ({
        id: r.id,
        permissions: r.permissions,
        parentIds: r.parentIds,
      })),
    );
    return new Set(effectivePermissions([...parentIds], map));
  }, [allRoles, parentIds]);

  function toggle(key: string, on: boolean) {
    setPermissions((prev) => {
      const next = new Set(prev);
      if (on) next.add(key);
      else next.delete(key);
      return next;
    });
  }

  function toggleParent(id: string, on: boolean) {
    setParentIds((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const input = {
      name: name.trim(),
      description: description.trim(),
      permissions: [...permissions],
      parentIds: [...parentIds],
    };
    try {
      if (role) await updateRole.mutateAsync({ id: role.id, input });
      else await createRole.mutateAsync(input);
      onDone();
    } catch {
      /* surfaced via toast in the hook */
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex h-full flex-col">
      <div className="flex-1 space-y-5 overflow-y-auto px-4">
        <div className="grid gap-2">
          <Label htmlFor="role-name">{t("name")}</Label>
          <Input
            id="role-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("namePlaceholder")}
            disabled={role?.isSystem}
            required
          />
          {role?.isSystem ? (
            <p className="text-xs text-muted-foreground">
              {t("systemNameLocked")}
            </p>
          ) : null}
        </div>
        <div className="grid gap-2">
          <Label htmlFor="role-desc">{t("descriptionCol")}</Label>
          <Input
            id="role-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t("descPlaceholder")}
          />
        </div>

        <div className="space-y-2">
          <Label>{t("inheritsFrom")}</Label>
          <p className="text-xs text-muted-foreground">{t("inheritsHint")}</p>
          <div className="grid gap-2 rounded-lg border border-border/60 p-3">
            {parentOptions.length ? (
              parentOptions.map((r) => (
                <label
                  key={r.id}
                  htmlFor={`parent-${r.id}`}
                  className="flex cursor-pointer items-center gap-3 text-sm"
                >
                  <Checkbox
                    id={`parent-${r.id}`}
                    checked={parentIds.has(r.id)}
                    onCheckedChange={(c) => toggleParent(r.id, c === true)}
                  />
                  {r.name}
                </label>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">
                {t("noOtherRoles")}
              </p>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <Label>{t("permissions")}</Label>
          {PERMISSION_GROUPS.map((group) => (
            <div
              key={group.key}
              className="rounded-lg border border-border/60 p-3"
            >
              <p className="mb-2 text-sm font-medium">
                {tp(`groups.${group.key}`)}
              </p>
              <div className="grid gap-3">
                {group.permissions.map((perm) => {
                  const isInherited = inherited.has(perm.key);
                  return (
                    <label
                      key={perm.key}
                      htmlFor={perm.key}
                      className="flex cursor-pointer items-start gap-3"
                    >
                      <Checkbox
                        id={perm.key}
                        checked={isInherited || permissions.has(perm.key)}
                        disabled={isInherited}
                        onCheckedChange={(c) => toggle(perm.key, c === true)}
                      />
                      <span className="space-y-0.5">
                        <span className="flex items-center gap-2 text-sm leading-none">
                          {tp(perm.key)}
                          {isInherited ? (
                            <Badge variant="secondary" className="text-[10px]">
                              {t("inherited")}
                            </Badge>
                          ) : null}
                        </span>
                        <span className="block text-xs text-muted-foreground">
                          {tp(`${perm.key}_desc`)}
                        </span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      <SheetFooter>
        <Button type="submit" disabled={pending}>
          <SwapText>
            {pending ? tc("saving") : role ? tc("save") : t("createBtn")}
          </SwapText>
        </Button>
      </SheetFooter>
    </form>
  );
}

export function RoleEditor() {
  const t = useTranslations("roles");
  const open = useRoleDialogStore((s) => s.open);
  const role = useRoleDialogStore((s) => s.role);
  const close = useRoleDialogStore((s) => s.close);

  return (
    <Sheet open={open} onOpenChange={(o) => !o && close()}>
      <SheetContent className="flex w-full flex-col gap-0 sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{role ? t("editTitle") : t("createTitle")}</SheetTitle>
          <SheetDescription>
            {role ? t("editSub") : t("createSub")}
          </SheetDescription>
        </SheetHeader>
        {/* key remounts the form with fresh defaults per open — no effect sync */}
        <RoleForm key={role?.id ?? "new"} role={role} onDone={close} />
      </SheetContent>
    </Sheet>
  );
}
