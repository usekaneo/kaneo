import getWorkspaces from "@/fetchers/workspace/get-workspaces";
import { useUserPreferencesStore } from "@/store/user-preferences";
import type Workspace from "@/types/workspace";
import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_layout/_authenticated/dashboard/")({
  beforeLoad: async () => {
    const workspaces: Workspace[] = await getWorkspaces();

    const { activeWorkspaceId } = useUserPreferencesStore.getState();

    if (workspaces && workspaces.length > 0) {
      if (
        activeWorkspaceId &&
        workspaces.some((ws) => ws.id === activeWorkspaceId)
      ) {
        throw redirect({
          to: "/dashboard/workspace/$workspaceId",
          params: { workspaceId: activeWorkspaceId },
        });
      }

      const firstWorkspace = workspaces[0];

      useUserPreferencesStore.setState({
        activeWorkspaceId: firstWorkspace.id,
      });

      throw redirect({
        to: "/dashboard/workspace/$workspaceId",
        params: { workspaceId: firstWorkspace.id },
      });
    }

    throw redirect({ to: "/onboarding" });
  },
});
