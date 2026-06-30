"use client";

import {
  CheckmarkCircle02Icon,
  Mail01Icon,
  UserIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useTranslations } from "next-intl";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  approveAuthorization,
  type ConsentParams,
  denyAuthorization,
} from "@/lib/actions/oauth-consent";

const SCOPE_INFO: Record<string, { key: string; icon: typeof UserIcon }> = {
  openid: { key: "scopeOpenid", icon: CheckmarkCircle02Icon },
  profile: { key: "scopeProfile", icon: UserIcon },
  email: { key: "scopeEmail", icon: Mail01Icon },
};

interface ConsentScreenProps {
  clientName: string;
  userEmail: string;
  params: ConsentParams;
}

export function ConsentScreen({
  clientName,
  userEmail,
  params,
}: ConsentScreenProps) {
  const t = useTranslations("oauth");
  const [pending, startTransition] = useTransition();
  const scopes = params.scope.split(" ").filter(Boolean);

  return (
    <Card className="w-full max-w-md border-border/60 shadow-2xl shadow-black/40">
      <CardHeader className="space-y-1">
        <CardTitle className="text-xl">
          {t("consentTitle", { app: clientName })}
        </CardTitle>
        <CardDescription>
          {t("consentSub", { app: clientName, email: userEmail })}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="mb-3 text-sm font-medium">{t("consentAllow")}</p>
        <ul className="space-y-2">
          {scopes.map((scope) => {
            const info = SCOPE_INFO[scope];
            if (!info) return null;
            return (
              <li key={scope} className="flex items-center gap-2 text-sm">
                <HugeiconsIcon
                  icon={info.icon}
                  className="size-4 text-muted-foreground"
                />
                {t(info.key)}
              </li>
            );
          })}
        </ul>
      </CardContent>
      <CardFooter className="gap-2">
        <Button
          variant="outline"
          className="flex-1"
          disabled={pending}
          onClick={() => startTransition(() => denyAuthorization(params))}
        >
          {t("deny")}
        </Button>
        <Button
          className="flex-1"
          disabled={pending}
          onClick={() => startTransition(() => approveAuthorization(params))}
        >
          {pending ? "…" : t("authorize")}
        </Button>
      </CardFooter>
    </Card>
  );
}
