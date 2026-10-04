import { createFileRoute, Outlet } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import PageTitle from "@/components/page-title";
import { SettingsShell } from "@/components/settings/settings-shell";

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/settings",
)({
  component: SettingsLayout,
});

function SettingsLayout() {
  const { t } = useTranslation();

  return (
    <>
      <PageTitle title={t("navigation:page.settingsTitle")} />
      <SettingsShell>
        <Outlet />
      </SettingsShell>
    </>
  );
}
