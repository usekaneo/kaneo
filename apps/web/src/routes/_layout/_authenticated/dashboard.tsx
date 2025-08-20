import PageTitle from "@/components/page-title";
import { SidebarProvider } from "@/components/ui/sidebar";
import useWorkspaceStore from "@/store/workspace";
import { Outlet, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_layout/_authenticated/dashboard")({
  component: DashboardLayoutComponent,
});

function DashboardLayoutComponent() {
  const { workspace } = useWorkspaceStore();

  return (
    <>
      <SidebarProvider>
        <PageTitle title="Dashboard" hideAppName={!workspace?.name} />
        <Outlet />
      </SidebarProvider>
    </>
  );
}
