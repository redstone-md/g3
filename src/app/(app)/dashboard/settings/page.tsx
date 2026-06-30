import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/dashboard/page-header";
import { AccountSection } from "@/components/settings/account-section";
import { AppearanceSection } from "@/components/settings/appearance-section";
import { LanguageSection } from "@/components/settings/language-section";
import { NotificationsSection } from "@/components/settings/notifications-section";
import { ProfileSection } from "@/components/settings/profile-section";
import { SessionsSection } from "@/components/settings/sessions-section";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { adminUserCount, grantsAdmin } from "@/lib/admin-guard";
import { verifySession } from "@/lib/dal";

export default async function SettingsPage() {
  const user = await verifySession();
  const t = await getTranslations("settings");
  // The last administrator cannot delete their own account.
  const isLastAdmin =
    grantsAdmin(user.permissions) && (await adminUserCount()) <= 1;

  return (
    <>
      <PageHeader title={t("title")} description={t("description")} />
      <Tabs defaultValue="profile" className="max-w-2xl">
        <TabsList>
          <TabsTrigger value="profile">{t("profile")}</TabsTrigger>
          <TabsTrigger value="appearance">{t("appearance")}</TabsTrigger>
          <TabsTrigger value="language">{t("language")}</TabsTrigger>
          <TabsTrigger value="notifications">{t("notifications")}</TabsTrigger>
          <TabsTrigger value="sessions">{t("sessions")}</TabsTrigger>
          <TabsTrigger value="account">{t("account")}</TabsTrigger>
        </TabsList>
        <TabsContent value="profile" className="mt-4">
          <ProfileSection
            name={user.name}
            avatar={user.avatar}
            email={user.email}
          />
        </TabsContent>
        <TabsContent value="appearance" className="mt-4">
          <AppearanceSection current={user.theme} motion={user.motion} />
        </TabsContent>
        <TabsContent value="language" className="mt-4">
          <LanguageSection current={user.locale} />
        </TabsContent>
        <TabsContent value="notifications" className="mt-4">
          <NotificationsSection enabled={user.notificationsEnabled} />
        </TabsContent>
        <TabsContent value="sessions" className="mt-4">
          <SessionsSection />
        </TabsContent>
        <TabsContent value="account" className="mt-4">
          <AccountSection email={user.email} isLastAdmin={isLastAdmin} />
        </TabsContent>
      </Tabs>
    </>
  );
}
