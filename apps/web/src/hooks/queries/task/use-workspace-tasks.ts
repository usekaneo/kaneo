import { useQuery } from "@tanstack/react-query";
import {
  getWorkspaceTasks,
  type WorkspaceTaskQuery,
} from "@/fetchers/task/get-workspace-tasks";

export function useWorkspaceTasks(
  workspaceId: string,
  filters: WorkspaceTaskQuery,
  page: number,
) {
  return useQuery({
    queryKey: ["workspace-tasks", workspaceId, filters, page],
    queryFn: () => getWorkspaceTasks(workspaceId, filters, page),
    enabled: Boolean(workspaceId),
    refetchOnMount: "always",
    refetchOnWindowFocus: "always",
    refetchInterval: 30_000,
  });
}
