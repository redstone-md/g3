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
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { verifySession } from "@/lib/dal";
import { QueryProvider } from "@/providers/query-provider";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await verifySession();
  const permissions = user.permissions;
  const roleNames = user.roles.map((r) => r.name).join(", ") || null;

  return (
    <SidebarProvider>
      <NotificationSetup enabled={user.notificationsEnabled} />
      <ThemeSync theme={user.theme} />
      <MotionSync motion={user.motion} />
      <CommandPalette permissions={permissions} />
      <AppSidebar permissions={permissions} />
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
        <QueryProvider>
          <div className="flex-1 p-4 sm:p-6 lg:p-8">{children}</div>
        </QueryProvider>
      </SidebarInset>
    </SidebarProvider>
  );
}
