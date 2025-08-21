import getWorkspaces from "@/fetchers/workspace/get-workspaces";
import { authClient } from "@/lib/auth-client";
import type { Workspace } from "@/types";
import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_layout/_authenticated/dashboard/")({
  beforeLoad: async () => {
    // Get current session to check for active workspace
    const session = await authClient.getSession();
    const activeWorkspaceId = session.data?.session?.activeOrganizationId;

    // Get user's workspaces
    const workspaces: Workspace[] = await getWorkspaces();

    // If user has no workspaces, redirect to create page
    if (!workspaces || workspaces.length === 0) {
      throw redirect({ to: "/dashboard/workspace/create" });
    }

    // If user has an active workspace and it exists in their workspace list, go there
    if (
      activeWorkspaceId &&
      workspaces.some((ws) => ws.id === activeWorkspaceId)
    ) {
      throw redirect({
        to: "/dashboard/workspace/$workspaceId",
        params: { workspaceId: activeWorkspaceId },
      });
    }

    // Default to first workspace if no active workspace is set
    const firstWorkspace = workspaces[0];
    throw redirect({
      to: "/dashboard/workspace/$workspaceId",
      params: { workspaceId: firstWorkspace.id },
    });
  },
});
