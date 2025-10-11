import { createFileRoute, redirect } from "@tanstack/react-router";
import getWorkspaces from "@/fetchers/workspace/get-workspaces";
import { authClient } from "@/lib/auth-client";
import { useUserPreferencesStore } from "@/store/user-preferences";
import type Workspace from "@/types/workspace";

export const Route = createFileRoute("/_layout/_authenticated/dashboard/")({
  beforeLoad: async () => {
    const workspaces: Workspace[] = await getWorkspaces();

    const pendingInvitation = document.cookie
      .split(";")
      .find((cookie) => cookie.trim().startsWith("pending_invitation="))
      ?.split("=")[1];

    if (pendingInvitation) {
      const { data } = await authClient.organization.acceptInvitation({
        invitationId: pendingInvitation,
      });

      authClient.organization.setActive({
        organizationId: data?.invitation.organizationId,
      });

      // biome-ignore lint/suspicious/noDocumentCookie: we need to set the cookie to the invite id
      document.cookie =
        "pending_invitation=; path=/; max-age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT";

      throw redirect({
        to: "/dashboard/workspace/$workspaceId",
        params: { workspaceId: data?.invitation.organizationId || "" },
      });
    }

    const { activeWorkspaceId } = useUserPreferencesStore.getState();

    if (workspaces && workspaces.length > 0) {
      if (
        activeWorkspaceId &&
        workspaces.some((ws) => ws.id === activeWorkspaceId)
      ) {
        authClient.organization.setActive({
          organizationId: activeWorkspaceId,
        });
        throw redirect({
          to: "/dashboard/workspace/$workspaceId",
          params: { workspaceId: activeWorkspaceId },
        });
      }

      const firstWorkspace = workspaces[0];

      useUserPreferencesStore.setState({
        activeWorkspaceId: firstWorkspace.id,
      });

      authClient.organization.setActive({
        organizationId: firstWorkspace.id,
      });

      throw redirect({
        to: "/dashboard/workspace/$workspaceId",
        params: { workspaceId: firstWorkspace.id },
      });
    }
    throw redirect({ to: "/onboarding" });
  },
});
