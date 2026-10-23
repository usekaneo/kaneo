import { useQuery } from "@tanstack/react-query";
import getWorkspaceDefaultLabels from "@/fetchers/label/get-workspace-default-labels";

export const WORKSPACE_DEFAULT_LABELS_KEY = [
  "labels",
  "workspace-project-defaults",
] as const;

// Default labels grouped by project, for the sidebar's project list.
function useGetWorkspaceDefaultLabels(workspaceId: string) {
  return useQuery({
    enabled: Boolean(workspaceId),
    queryKey: [...WORKSPACE_DEFAULT_LABELS_KEY, workspaceId],
    queryFn: () => getWorkspaceDefaultLabels(workspaceId),
    select: (rows) => {
      const byProject = new Map<string, typeof rows>();
      for (const row of rows)
        byProject.set(row.projectId, [
          ...(byProject.get(row.projectId) ?? []),
          row,
        ]);
      return byProject;
    },
  });
}

export default useGetWorkspaceDefaultLabels;
