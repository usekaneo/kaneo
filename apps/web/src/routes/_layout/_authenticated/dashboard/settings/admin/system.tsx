import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import SystemStatusPanel from "@/components/admin/system/system-status-panel";
import PageTitle from "@/components/page-title";

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/settings/admin/system",
)({
  component: RouteComponent,
});

function RouteComponent() {
  const { t } = useTranslation();

  return (
    <>
      <PageTitle title={t("settings:adminSystem.title")} />
      <SystemStatusPanel />
    </>
  );
}
