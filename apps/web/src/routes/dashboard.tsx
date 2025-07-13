import { DemoAlert } from "@/components/demo-alert";
import PageTitle from "@/components/page-title";
import { SidebarProvider } from "@/components/ui/sidebar";
import { isDemoMode } from "@/constants/urls";
import useWorkspaceStore from "@/store/workspace";
import { Outlet, createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/dashboard")({
  component: DashboardIndexRouteComponent,
  async beforeLoad({ context: { user } }) {
    if (user === null) {
      throw redirect({
        to: "/auth/sign-in",
      });
    }
  },
});

function DashboardIndexRouteComponent() {
  const { workspace } = useWorkspaceStore();

  return (
    <>
      <SidebarProvider>
        <PageTitle title="Dashboard" hideAppName={!workspace?.name} />
        {isDemoMode && <DemoAlert />}
        <Outlet />
      </SidebarProvider>
    </>
  );
}
