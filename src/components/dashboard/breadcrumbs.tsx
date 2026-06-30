"use client";

import { ArrowRight01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { Fragment } from "react";

// Segment → message key. `dashboard` is the Style Guide landing.
const KEYS: Record<string, string> = {
  dashboard: "nav.styleGuide",
  roles: "nav.roles",
  users: "nav.users",
  accounts: "nav.accounts",
  audit: "nav.audit",
  settings: "settings.title",
};

export function Breadcrumbs() {
  const pathname = usePathname();
  const t = useTranslations();
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length === 0) return null;

  const crumbs = segments.map((segment, i) => ({
    label: KEYS[segment] ? t(KEYS[segment]) : segment,
    href: `/${segments.slice(0, i + 1).join("/")}`,
    last: i === segments.length - 1,
  }));

  return (
    <nav
      aria-label={t("common.breadcrumb")}
      className="flex items-center gap-1.5 text-sm"
    >
      {crumbs.map((crumb) => (
        <Fragment key={crumb.href}>
          {crumb.last ? (
            <span className="font-medium">{crumb.label}</span>
          ) : (
            <>
              <Link
                href={crumb.href}
                className="text-muted-foreground hover:text-foreground"
              >
                {crumb.label}
              </Link>
              <HugeiconsIcon
                icon={ArrowRight01Icon}
                className="size-3.5 text-muted-foreground/60"
              />
            </>
          )}
        </Fragment>
      ))}
    </nav>
  );
}
