"use client";

import {
  ConnectIcon,
  Loading03Icon,
  LockPasswordIcon,
  Mail01Icon,
} from "@hugeicons/core-free-icons";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { useShake } from "@/hooks/use-shake";
import { type AuthFormState, login } from "@/lib/actions/auth";

export function LoginForm({
  next,
  showSso = false,
  ssoError = false,
}: {
  next?: string;
  showSso?: boolean;
  ssoError?: boolean;
}) {
  const t = useTranslations("auth");
  const [state, action, pending] = useActionState<
    AuthFormState | undefined,
    FormData
  >(login, undefined);
  const shakeRef = useShake<HTMLFormElement>(
    state?.error ? state : ssoError || null,
  );

  return (
    <Card className="t-enter w-full max-w-sm border-border/60 shadow-2xl shadow-black/40">
      <div>
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-semibold tracking-tight">
            {t("welcome")}
          </CardTitle>
          <CardDescription>{t("signInSub")}</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            ref={shakeRef}
            action={action}
            className="t-input flex flex-col gap-4"
          >
            {next ? <input type="hidden" name="next" value={next} /> : null}
            {ssoError ? (
              <Alert variant="destructive">
                <AlertDescription>{t("ssoError")}</AlertDescription>
              </Alert>
            ) : null}
            {state?.error ? (
              <Alert variant="destructive">
                <AlertDescription>{state.error}</AlertDescription>
              </Alert>
            ) : null}

            <div className="grid gap-2">
              <Label htmlFor="email">{t("email")}</Label>
              <div className="relative">
                <HugeiconsIcon
                  icon={Mail01Icon}
                  className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                />
                <Input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  placeholder="admin@g3.local"
                  className="pl-9"
                  required
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="password">{t("password")}</Label>
              <div className="relative">
                <HugeiconsIcon
                  icon={LockPasswordIcon}
                  className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                />
                <PasswordInput
                  id="password"
                  name="password"
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className="pl-9"
                  required
                />
              </div>
            </div>

            <Button type="submit" disabled={pending} className="mt-2 w-full">
              {pending ? (
                <HugeiconsIcon icon={Loading03Icon} className="animate-spin" />
              ) : null}
              {pending ? t("signingIn") : t("signIn")}
            </Button>
          </form>

          {showSso ? (
            <>
              <div className="my-4 flex items-center gap-3">
                <span className="h-px flex-1 bg-border" />
                <span className="text-xs text-muted-foreground">{t("or")}</span>
                <span className="h-px flex-1 bg-border" />
              </div>
              <Button asChild variant="outline" className="w-full">
                <a href="/api/auth/sso/login">
                  <HugeiconsIcon icon={ConnectIcon} />
                  {t("sso")}
                </a>
              </Button>
            </>
          ) : null}
        </CardContent>
      </div>
    </Card>
  );
}
