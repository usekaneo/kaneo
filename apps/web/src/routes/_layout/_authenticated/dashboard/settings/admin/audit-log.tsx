import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import AuditLogPanel from "@/components/admin/audit-log/audit-log-panel";
import PageTitle from "@/components/page-title";

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/settings/admin/audit-log",
)({
  component: RouteComponent,
});

function RouteComponent() {
  const { t } = useTranslation();

  return (
    <>
      <PageTitle title={t("settings:adminAuditLog.title")} />
      <AuditLogPanel />
    </>
  );
}
