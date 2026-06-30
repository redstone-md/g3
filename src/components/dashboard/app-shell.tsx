"use client";

import { useEffect } from "react";
import { AppSidebar } from "@/components/dashboard/app-sidebar";
import { Breadcrumbs } from "@/components/dashboard/breadcrumbs";
import { CommandPalette } from "@/components/dashboard/command-palette";
import { CommandTrigger } from "@/components/dashboard/command-trigger";
import { UserMenu } from "@/components/dashboard/user-menu";
import { NotificationSetup } from "@/components/notifications/notification-setup";
import { MotionSync } from "@/components/theme/motion-sync";
import { ThemeSwitcher } from "@/components/theme/theme-switcher";
import { ThemeSync } from "@/components/theme/theme-sync";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { AuthProvider } from "@/components/auth/auth-context";
import { useMeQuery } from "@/hooks/use-auth";
import { QueryProvider } from "@/providers/query-provider";

/**
 * Authenticated dashboard shell. Replaces the former server `(app)/layout`:
 * it loads the signed-in user from the Go backend, redirects to /login on an
 * unauthorized response, and provides the user to the page subtree.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <QueryProvider>
      <ShellInner>{children}</ShellInner>
    </QueryProvider>
  );
}

function ShellInner({ children }: { children: React.ReactNode }) {
  const { data: user, isError } = useMeQuery();

  useEffect(() => {
    if (isError) {
      const next = encodeURIComponent(
        window.location.pathname + window.location.search,
      );
      window.location.assign(`/login?next=${next}`);
    }
  }, [isError]);

  useEffect(() => {
    if (user?.mustChangePassword) window.location.assign("/account/password");
  }, [user?.mustChangePassword]);

  if (!user) return <ShellSkeleton />;

  const roleNames = user.roles.map((r) => r.name).join(", ") || null;

  return (
    <AuthProvider user={user}>
      <SidebarProvider>
        <NotificationSetup enabled={user.notificationsEnabled} />
        <ThemeSync theme={user.theme} />
        <MotionSync motion={user.motion} />
        <CommandPalette permissions={user.permissions} />
        <AppSidebar permissions={user.permissions} />
        <SidebarInset>
          <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-2 border-b border-border/60 bg-background/80 px-4 backdrop-blur">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-2 h-4" />
            <Breadcrumbs />
            <div className="flex-1" />
            <CommandTrigger />
            <ThemeSwitcher current={user.theme} />
            <UserMenu
              name={user.name}
              email={user.email}
              avatar={user.avatar}
              roleName={roleNames}
            />
          </header>
          <div className="flex-1 p-4 sm:p-6 lg:p-8">{children}</div>
        </SidebarInset>
      </SidebarProvider>
    </AuthProvider>
  );
}

/** Full-frame placeholder while the session is verified (genuine load). */
function ShellSkeleton() {
  return (
    <div className="flex min-h-dvh">
      <div className="hidden w-64 shrink-0 border-r border-border/60 p-4 md:block">
        <Skeleton className="h-8 w-32" />
        <div className="mt-6 space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-full" />
          ))}
        </div>
      </div>
      <div className="flex-1">
        <div className="flex h-14 items-center gap-2 border-b border-border/60 px-4">
          <Skeleton className="h-6 w-40" />
          <div className="flex-1" />
          <Skeleton className="size-8 rounded-full" />
        </div>
        <div className="p-8">
          <Skeleton className="h-9 w-64" />
          <Skeleton className="mt-3 h-5 w-96" />
          <Skeleton className="mt-8 h-64 w-full" />
        </div>
      </div>
    </div>
  );
}
