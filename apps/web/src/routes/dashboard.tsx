import { Sidebar } from "@/components/common/sidebar";
import { DemoAlert } from "@/components/demo-alert";
import EmptyWorkspaceState from "@/components/workspace/empty-state";
import SelectWorkspaceState from "@/components/workspace/select-workspace-state";
import { isDemoMode } from "@/constants/urls";
import useGetWorkspaces from "@/hooks/queries/workspace/use-get-workspaces";
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
  const { data: workspaces } = useGetWorkspaces();

  const hasNoWorkspacesAndNoSelectedWorkspace =
    workspaces?.length === 0 && !workspace;

  return (
    <>
      <Sidebar />
      <main className="flex-1 overflow-hidden scroll-smooth">
        {isDemoMode && <DemoAlert />}
        {hasNoWorkspacesAndNoSelectedWorkspace && <EmptyWorkspaceState />}
        {!workspace && workspaces && workspaces.length > 0 && (
          <SelectWorkspaceState />
        )}
        <Outlet />
      </main>
    </>
  );
}
