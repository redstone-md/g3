"use client";

import { Loading03Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { useShake } from "@/hooks/use-shake";
import { type AuthFormState, changePassword } from "@/lib/actions/auth";

export function ChangePasswordForm({ mustChange }: { mustChange: boolean }) {
  const t = useTranslations("auth");
  const [state, action, pending] = useActionState<
    AuthFormState | undefined,
    FormData
  >(changePassword, undefined);
  const shakeRef = useShake<HTMLFormElement>(state?.error ? state : null);

  return (
    <Card className="t-enter w-full max-w-sm border-border/60 shadow-2xl shadow-black/40">
      <div>
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-semibold tracking-tight">
            {t("changeTitle")}
          </CardTitle>
          <CardDescription>
            {mustChange ? t("changeSubForced") : t("changeSub")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            ref={shakeRef}
            action={action}
            className="t-input flex flex-col gap-4"
          >
            {state?.error ? (
              <Alert variant="destructive">
                <AlertDescription>{state.error}</AlertDescription>
              </Alert>
            ) : null}

            <div className="grid gap-2">
              <Label htmlFor="current">{t("current")}</Label>
              <PasswordInput id="current" name="current" required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="next">{t("new")}</Label>
              <PasswordInput id="next" name="next" required strength />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="confirm">{t("confirm")}</Label>
              <PasswordInput id="confirm" name="confirm" required />
            </div>

            <Button type="submit" disabled={pending} className="mt-2 w-full">
              {pending ? (
                <HugeiconsIcon icon={Loading03Icon} className="animate-spin" />
              ) : null}
              {t("update")}
            </Button>
          </form>
        </CardContent>
      </div>
    </Card>
  );
}
