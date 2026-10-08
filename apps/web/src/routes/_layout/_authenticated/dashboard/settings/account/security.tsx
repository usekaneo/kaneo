import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { ChangePasswordSettings } from "@/components/account/change-password-settings";
import PageTitle from "@/components/page-title";
import { SettingsPage } from "@/components/settings/settings-page";

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/settings/account/security",
)({
  component: RouteComponent,
});

function RouteComponent() {
  const { t } = useTranslation();

  return (
    <>
      <PageTitle title={t("settings:securityPage.pageTitle")} />
      <SettingsPage
        title={t("settings:securityPage.title")}
        description={t("settings:securityPage.subtitle")}
      >
        <ChangePasswordSettings />
      </SettingsPage>
    </>
  );
}
