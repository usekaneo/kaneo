import { createFileRoute, Outlet } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import PageTitle from "@/components/page-title";
import useActiveWorkspace from "@/hooks/queries/workspace/use-active-workspace";

export const Route = createFileRoute("/_layout/_authenticated/dashboard")({
  component: DashboardLayoutComponent,
});

function DashboardLayoutComponent() {
  const { t } = useTranslation();
  const { data: workspace } = useActiveWorkspace();

  return (
    <>
      <PageTitle
        title={t("navigation:page.projectsTitle")}
        hideAppName={!workspace?.name}
      />
      <Outlet />
    </>
  );
}
