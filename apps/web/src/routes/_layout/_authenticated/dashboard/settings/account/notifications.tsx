import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { NotificationPreferencesSettings } from "@/components/account/notification-preferences-settings";
import PageTitle from "@/components/page-title";
import { SettingsPage } from "@/components/settings/settings-page";

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/settings/account/notifications",
)({
  component: RouteComponent,
});

function RouteComponent() {
  const { t } = useTranslation();

  return (
    <>
      <PageTitle title={t("settings:notificationsPage.pageTitle")} />
      <SettingsPage
        title={t("settings:notificationsPage.title")}
        description={t("settings:notificationsPage.subtitle")}
      >
        <NotificationPreferencesSettings />
      </SettingsPage>
    </>
  );
}
