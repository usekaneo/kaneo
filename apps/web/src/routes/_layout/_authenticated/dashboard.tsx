import { createFileRoute, Outlet } from "@tanstack/react-router";
import PageTitle from "@/components/page-title";
import useActiveWorkspace from "@/hooks/queries/workspace/use-active-workspace";

export const Route = createFileRoute("/_layout/_authenticated/dashboard")({
  component: DashboardLayoutComponent,
});

function DashboardLayoutComponent() {
  const { data: workspace } = useActiveWorkspace();

  return (
    <>
      <PageTitle title="Projects" hideAppName={!workspace?.name} />
      <Outlet />
    </>
  );
}
