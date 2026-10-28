import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import UserManagementPanel from "@/components/admin/user-management/user-management-panel";
import PageTitle from "@/components/page-title";

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/settings/admin/users",
)({
  validateSearch: (search: Record<string, unknown>): { role?: string } =>
    typeof search.role === "string" && search.role !== ""
      ? { role: search.role }
      : {},
  component: RouteComponent,
});

function RouteComponent() {
  const { t } = useTranslation();
  const { role } = Route.useSearch();

  return (
    <>
      <PageTitle title={t("settings:adminUsers.title")} />
      <UserManagementPanel key={role} initialRole={role} />
    </>
  );
}
