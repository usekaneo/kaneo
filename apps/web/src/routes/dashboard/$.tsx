import useGetWorkspaces from "@/hooks/queries/workspace/use-get-workspaces";
import { useUserPreferencesStore } from "@/store/user-preferences";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

export const Route = createFileRoute("/dashboard/$")({
  component: CatchAllComponent,
});

function CatchAllComponent() {
  const { data: workspaces } = useGetWorkspaces();
  const { activeWorkspaceId, setActiveWorkspaceId } = useUserPreferencesStore();
  const navigate = useNavigate();

  useEffect(() => {
    if (workspaces && workspaces.length > 0) {
      if (
        activeWorkspaceId &&
        workspaces.some((ws) => ws.id === activeWorkspaceId)
      ) {
        navigate({
          to: "/dashboard/workspace/$workspaceId",
          params: {
            workspaceId: activeWorkspaceId,
          },
        });
      } else {
        const firstWorkspace = workspaces[0];
        setActiveWorkspaceId(firstWorkspace.id);
        navigate({
          to: "/dashboard/workspace/$workspaceId",
          params: {
            workspaceId: firstWorkspace.id,
          },
        });
      }
    }
  }, [workspaces, activeWorkspaceId, setActiveWorkspaceId, navigate]);

  return null;
}
