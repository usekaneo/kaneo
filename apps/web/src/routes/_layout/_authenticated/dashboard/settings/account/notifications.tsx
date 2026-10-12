import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import PageTitle from "@/components/page-title";
import { NotificationSettings } from "@/components/settings/notifications/notification-settings";
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
        <NotificationSettings />
      </SettingsPage>
    </>
  );
}
