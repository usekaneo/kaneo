import { useNavigate } from "@tanstack/react-router";
import { useCallback } from "react";
import useActiveWorkspace from "@/hooks/queries/workspace/use-active-workspace";

// Returns undefined until there is a workspace to go back to.
export function useLeaveSettings() {
  const navigate = useNavigate();
  const { data: workspace } = useActiveWorkspace();
  const workspaceId = workspace?.id;

  const leave = useCallback(() => {
    if (!workspaceId) return;
    navigate({
      to: "/dashboard/workspace/$workspaceId",
      params: { workspaceId },
    });
  }, [navigate, workspaceId]);

  return workspaceId ? leave : undefined;
}
