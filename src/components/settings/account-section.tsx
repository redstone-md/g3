"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { SwapText } from "@/components/ui/swap-text";
import { changeEmail, deleteAccount } from "@/lib/actions/account";

export function AccountSection({
  email,
  isLastAdmin,
}: {
  email: string;
  isLastAdmin: boolean;
}) {
  const t = useTranslations("settings");
  const tc = useTranslations("common");
  const [newEmail, setNewEmail] = useState(email);
  const [emailPassword, setEmailPassword] = useState("");
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [deleting, startDelete] = useTransition();

  function submitEmail(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await changeEmail({
        email: newEmail.trim(),
        currentPassword: emailPassword,
      });
      if (res.ok) {
        toast.success(t("emailChanged"));
        setEmailPassword("");
      } else {
        toast.error(res.error ?? "Error");
      }
    });
  }

  function confirmDelete() {
    startDelete(async () => {
      const res = await deleteAccount({ currentPassword: deletePassword });
      // On success the action redirects; only errors return here.
      if (res && !res.ok) toast.error(res.error ?? "Error");
    });
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{t("account")}</CardTitle>
          <CardDescription>{t("accountDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submitEmail} className="grid max-w-sm gap-4">
            <div className="grid gap-2">
              <Label htmlFor="acc-email">{t("newEmail")}</Label>
              <Input
                id="acc-email"
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="acc-pw">{t("currentPassword")}</Label>
              <PasswordInput
                id="acc-pw"
                value={emailPassword}
                onChange={(e) => setEmailPassword(e.target.value)}
                required
              />
            </div>
            <Button type="submit" disabled={pending} className="w-fit">
              <SwapText>{pending ? t("saving") : t("changeEmailBtn")}</SwapText>
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("exportData")}</CardTitle>
          <CardDescription>{t("exportDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild variant="outline">
            <a href="/api/account/export" download>
              {t("download")}
            </a>
          </Button>
        </CardContent>
      </Card>

      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle className="text-destructive">{t("dangerZone")}</CardTitle>
          <CardDescription>{t("deleteAccountDescription")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {isLastAdmin ? (
            <p className="text-sm text-muted-foreground">
              {t("cannotDeleteLastAdmin")}
            </p>
          ) : null}
          <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
            <DialogTrigger asChild>
              <Button variant="destructive" disabled={isLastAdmin}>
                {t("deleteAccount")}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t("deleteAccount")}</DialogTitle>
                <DialogDescription>
                  {t("deleteAccountConfirm")}
                </DialogDescription>
              </DialogHeader>
              <PasswordInput
                value={deletePassword}
                onChange={(e) => setDeletePassword(e.target.value)}
                placeholder={t("currentPassword")}
              />
              <DialogFooter>
                <Button variant="outline" onClick={() => setDeleteOpen(false)}>
                  {tc("cancel")}
                </Button>
                <Button
                  variant="destructive"
                  onClick={confirmDelete}
                  disabled={deleting}
                >
                  <SwapText>
                    {deleting ? t("saving") : t("deleteAccount")}
                  </SwapText>
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>
    </div>
  );
}
