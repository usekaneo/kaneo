import { createFileRoute, Outlet, useLocation } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import PageTitle from "@/components/page-title";
import useActiveWorkspace from "@/hooks/queries/workspace/use-active-workspace";
import { usePendingCheckout } from "@/hooks/use-pending-checkout";

export const Route = createFileRoute("/_layout/_authenticated/dashboard")({
  component: DashboardLayoutComponent,
});

function DashboardLayoutComponent() {
  const { t } = useTranslation();
  const { data: workspace } = useActiveWorkspace();
  const pathname = useLocation({ select: (location) => location.pathname });
  usePendingCheckout();

  return (
    <>
      {pathname.replace(/\/+$/, "") === "/dashboard" && (
        <PageTitle
          title={t("navigation:page.projectsTitle")}
          hideAppName={!workspace?.name}
        />
      )}
      <Outlet />
    </>
  );
}
