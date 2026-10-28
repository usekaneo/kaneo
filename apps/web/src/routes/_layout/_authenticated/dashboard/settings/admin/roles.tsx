import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import RolesPanel from "@/components/admin/roles/roles-panel";
import PageTitle from "@/components/page-title";

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/settings/admin/roles",
)({
  component: RouteComponent,
});

function RouteComponent() {
  const { t } = useTranslation();

  return (
    <>
      <PageTitle title={t("settings:adminRoles.title")} />
      <RolesPanel />
    </>
  );
}
