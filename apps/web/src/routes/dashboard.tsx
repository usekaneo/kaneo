import { DemoAlert } from "@/components/demo-alert";
import PageTitle from "@/components/page-title";
import { SidebarProvider } from "@/components/ui/sidebar";
import { isDemoMode } from "@/constants/urls";
import getWorkspaces from "@/fetchers/workspace/get-workspaces";
import useGetWorkspaces from "@/hooks/queries/workspace/use-get-workspaces";
import { useUserPreferencesStore } from "@/store/user-preferences";
import useWorkspaceStore from "@/store/workspace";
import { Outlet, createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect } from "react";

export const Route = createFileRoute("/dashboard")({
  component: DashboardIndexRouteComponent,
  async beforeLoad({ context: { user } }) {
    if (user === null) {
      throw redirect({
        to: "/auth/sign-in",
      });
    }

    const workspaces = await getWorkspaces();

    if (workspaces.length === 0) {
      throw redirect({
        to: "/dashboard/workspace/create",
      });
    }
  },
});

function DashboardIndexRouteComponent() {
  const { workspace, setWorkspace } = useWorkspaceStore();
  const { data: workspaces } = useGetWorkspaces();
  const { activeWorkspaceId, setActiveWorkspaceId } = useUserPreferencesStore();

  useEffect(() => {
    if (workspaces && workspaces.length > 0 && !workspace) {
      if (
        activeWorkspaceId &&
        workspaces.some((ws) => ws.id === activeWorkspaceId)
      ) {
        const activeWorkspace = workspaces.find(
          (ws) => ws.id === activeWorkspaceId,
        );
        if (activeWorkspace) {
          setWorkspace(activeWorkspace);
        }
      } else {
        const firstWorkspace = workspaces[0];
        setActiveWorkspaceId(firstWorkspace.id);
        setWorkspace(firstWorkspace);
      }
    }
  }, [
    workspaces,
    workspace,
    activeWorkspaceId,
    setActiveWorkspaceId,
    setWorkspace,
  ]);

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
