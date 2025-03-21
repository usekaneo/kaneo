import { Sidebar } from "@/components/common/sidebar";
import { DemoAlert } from "@/components/demo-alert";
import PageTitle from "@/components/page-title";
import EmptyWorkspaceState from "@/components/workspace/empty-state";
import SelectWorkspaceState from "@/components/workspace/select-workspace-state";
import { isDemoMode } from "@/constants/urls";
import useGetWorkspaces from "@/hooks/queries/workspace/use-get-workspaces";
import useWorkspaceStore from "@/store/workspace";
import {
  Outlet,
  createFileRoute,
  redirect,
  useRouterState,
} from "@tanstack/react-router";

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
  const location = useRouterState({ select: (s) => s.location.pathname });

  const hasNoWorkspacesAndNoSelectedWorkspace =
    workspaces?.length === 0 && !workspace;

  const isOnWorkspaceRoute = location === "/dashboard";

  return (
    <>
      <PageTitle title="Dashboard" hideAppName={!workspace?.name} />
      <Sidebar />
      <main className="w-full overflow-auto scroll-smooth flex flex-col">
        {isDemoMode && <DemoAlert />}
        {isOnWorkspaceRoute && (
          <>
            {hasNoWorkspacesAndNoSelectedWorkspace && <EmptyWorkspaceState />}
            {!workspace && workspaces && workspaces.length > 0 && (
              <SelectWorkspaceState />
            )}
          </>
        )}
        <Outlet />
      </main>
    </>
  );
}
