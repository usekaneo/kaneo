import { createFileRoute, redirect } from "@tanstack/react-router";
import { getPendingInvitations } from "@/fetchers/invitation/get-pending-invitations";
import getWorkspaces from "@/fetchers/workspace/get-workspaces";
import { authClient } from "@/lib/auth-client";
import type Workspace from "@/types/workspace";

const getWorkspaceLandingPath = async (
  workspaceId: string,
  userId: string | undefined,
) => {
  if (!userId) {
    return "/dashboard/workspace/$workspaceId/my-tasks" as const;
  }

  const { data, error } = await authClient.organization.listMembers({
    query: {
      organizationId: workspaceId,
    },
  });

  if (error) {
    console.error("Failed to get workspace role for landing page:", error);
    return "/dashboard/workspace/$workspaceId/my-tasks" as const;
  }

  const activeMember = data.members.find((member) => member.userId === userId);

  return activeMember?.role === "owner"
    ? "/dashboard/workspace/$workspaceId"
    : "/dashboard/workspace/$workspaceId/my-tasks";
};

export const Route = createFileRoute("/_layout/_authenticated/dashboard/")({
  beforeLoad: async () => {
    const workspaces: Workspace[] = await getWorkspaces();
    const invitations = await getPendingInvitations();

    if (invitations && invitations.length > 0 && !workspaces.length) {
      throw redirect({ to: "/invitations" });
    }

    const session = await authClient.getSession();
    const activeWorkspaceId = session?.data?.session?.activeOrganizationId;
    const userId = session?.data?.user?.id;

    if (workspaces && workspaces.length > 0) {
      if (
        activeWorkspaceId &&
        workspaces.some((ws) => ws.id === activeWorkspaceId)
      ) {
        const landingPath = await getWorkspaceLandingPath(
          activeWorkspaceId,
          userId,
        );

        throw redirect({
          to: landingPath,
          params: { workspaceId: activeWorkspaceId },
        });
      }

      const firstWorkspace = workspaces[0];

      await authClient.organization.setActive({
        organizationId: firstWorkspace.id,
      });

      const landingPath = await getWorkspaceLandingPath(
        firstWorkspace.id,
        userId,
      );

      throw redirect({
        to: landingPath,
        params: { workspaceId: firstWorkspace.id },
      });
    }
    throw redirect({ to: "/onboarding" });
  },
});
