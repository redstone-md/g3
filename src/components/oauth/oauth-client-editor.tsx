"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { CopyButton } from "@/components/ui/copy-button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { SuccessCheck } from "@/components/ui/success-check";
import { SwapText } from "@/components/ui/swap-text";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  useCreateOAuthClient,
  useUpdateOAuthClient,
} from "@/hooks/use-oauth-clients";
import type { OAuthClientDTO } from "@/lib/types";
import { useOAuthDialogStore } from "@/stores/use-oauth-dialog-store";

const SCOPES = ["openid", "profile", "email"] as const;

function ClientForm({
  client,
  onDone,
}: {
  client: OAuthClientDTO | null;
  onDone: () => void;
}) {
  const t = useTranslations("oauth");
  const tc = useTranslations("common");
  const [name, setName] = useState(client?.name ?? "");
  const [uris, setUris] = useState((client?.redirectUris ?? []).join("\n"));
  const [scopes, setScopes] = useState<Set<string>>(
    new Set(client?.scopes ?? ["openid", "profile", "email"]),
  );
  const [isPublic, setIsPublic] = useState(client?.isPublic ?? false);

  const showCredentials = useOAuthDialogStore((s) => s.showCredentials);
  const createClient = useCreateOAuthClient();
  const updateClient = useUpdateOAuthClient();
  const pending = createClient.isPending || updateClient.isPending;

  function toggleScope(scope: string, on: boolean) {
    setScopes((prev) => {
      const next = new Set(prev);
      if (on) next.add(scope);
      else next.delete(scope);
      return next;
    });
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const input = {
      name: name.trim(),
      redirectUris: uris
        .split("\n")
        .map((u) => u.trim())
        .filter(Boolean),
      scopes: [...scopes] as ("openid" | "profile" | "email")[],
      isPublic,
    };
    try {
      if (client) {
        await updateClient.mutateAsync({ id: client.id, input });
      } else {
        const created = await createClient.mutateAsync(input);
        showCredentials({
          clientId: created.clientId,
          clientSecret: created.clientSecret,
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
          <Label htmlFor="oc-name">{t("name")}</Label>
          <Input
            id="oc-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("namePlaceholder")}
            required
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="oc-uris">{t("redirectUris")}</Label>
          <Textarea
            id="oc-uris"
            value={uris}
            onChange={(e) => setUris(e.target.value)}
            placeholder={"https://app.example.com/api/auth/sso/callback"}
            rows={3}
            required
          />
          <p className="text-xs text-muted-foreground">
            {t("redirectUrisHint")}
          </p>
        </div>
        <div className="space-y-2">
          <Label>{t("scopes")}</Label>
          <div className="flex flex-wrap gap-4">
            {SCOPES.map((scope) => (
              <label
                key={scope}
                htmlFor={`scope-${scope}`}
                className="flex cursor-pointer items-center gap-2 text-sm"
              >
                <Checkbox
                  id={`scope-${scope}`}
                  checked={scopes.has(scope)}
                  onCheckedChange={(c) => toggleScope(scope, c === true)}
                />
                {scope}
              </label>
            ))}
          </div>
        </div>
        <div className="flex items-center justify-between rounded-lg border border-border/60 p-3">
          <Label htmlFor="oc-public" className="flex flex-col gap-1">
            <span>{t("publicLabel")}</span>
            <span className="text-xs font-normal text-muted-foreground">
              {t("publicHint")}
            </span>
          </Label>
          <Switch
            id="oc-public"
            checked={isPublic}
            onCheckedChange={setIsPublic}
          />
        </div>
      </div>

      <SheetFooter>
        <Button type="submit" disabled={pending}>
          <SwapText>
            {pending ? tc("saving") : client ? tc("save") : t("createBtn")}
          </SwapText>
        </Button>
      </SheetFooter>
    </form>
  );
}

export function OAuthClientEditor() {
  const t = useTranslations("oauth");
  const open = useOAuthDialogStore((s) => s.open);
  const client = useOAuthDialogStore((s) => s.client);
  const close = useOAuthDialogStore((s) => s.close);

  return (
    <Sheet open={open} onOpenChange={(o) => !o && close()}>
      <SheetContent className="flex w-full flex-col gap-0 sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{client ? t("editTitle") : t("createTitle")}</SheetTitle>
          <SheetDescription>
            {client ? t("editSub") : t("createSub")}
          </SheetDescription>
        </SheetHeader>
        <ClientForm key={client?.id ?? "new"} client={client} onDone={close} />
      </SheetContent>
    </Sheet>
  );
}

function CopyRow({ label, value }: { label: string; value: string }) {
  const t = useTranslations("oauth");
  return (
    <div className="grid gap-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="flex items-center gap-2">
        <code className="flex-1 truncate rounded bg-muted px-2 py-1.5 font-mono text-xs">
          {value}
        </code>
        <CopyButton
          value={value}
          label={t("copy")}
          onCopied={() => toast.success(t("copied"))}
        />
      </div>
    </div>
  );
}

export function OAuthCredentialsDialog() {
  const t = useTranslations("oauth");
  const credentials = useOAuthDialogStore((s) => s.credentials);
  const clear = useOAuthDialogStore((s) => s.clearCredentials);

  return (
    <Dialog open={!!credentials} onOpenChange={(o) => !o && clear()}>
      <DialogContent>
        <DialogHeader>
          <SuccessCheck className="mx-auto mb-1 size-12" />
          <DialogTitle>{t("credsTitle")}</DialogTitle>
          <DialogDescription>{t("credsDesc")}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {credentials ? (
            <CopyRow label={t("clientId")} value={credentials.clientId} />
          ) : null}
          {credentials?.clientSecret ? (
            <CopyRow
              label={t("clientSecret")}
              value={credentials.clientSecret}
            />
          ) : (
            <p className="text-sm text-muted-foreground">
              {t("publicNoSecret")}
            </p>
          )}
        </div>
        <DialogFooter>
          <Button onClick={clear}>{t("done")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
