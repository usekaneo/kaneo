import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import getWorkspaceBoard, {
  type WorkspaceBoard,
  type WorkspaceBoardQuery,
} from "@/fetchers/task/get-workspace-board";
import { WORKSPACE_BOARD_KEY } from "@/lib/workspace-board/update-active-workspace-boards";

export function workspaceBoardQueryKey(
  workspaceId: string | undefined,
  query?: WorkspaceBoardQuery,
) {
  return query
    ? ([...WORKSPACE_BOARD_KEY, workspaceId, query] as const)
    : ([...WORKSPACE_BOARD_KEY, workspaceId] as const);
}

export function useGetWorkspaceBoard(
  workspaceId: string | undefined,
  query: WorkspaceBoardQuery,
  options: { enabled?: boolean } = {},
) {
  const queryClient = useQueryClient();
  const [progress, setProgress] = useState<WorkspaceBoard>();
  const queryKey = workspaceBoardQueryKey(workspaceId, query);
  const result = useQuery({
    queryKey,
    queryFn: async ({ signal }) => {
      // Partial pages only matter while nothing is on screen yet; polls and
      // refreshes replace the board once, when every page is in.
      const firstLoad = queryClient.getQueryData(queryKey) === undefined;
      setProgress(undefined);
      try {
        return await getWorkspaceBoard(
          workspaceId ?? "",
          query,
          signal,
          firstLoad ? (board) => setProgress(board) : undefined,
        );
      } finally {
        setProgress(undefined);
      }
    },
    enabled: Boolean(workspaceId) && (options.enabled ?? true),
    // Workspace pages have no project socket; poll while visible and refresh
    // whenever the user comes back, like My tasks does.
    refetchOnMount: "always",
    refetchInterval: 30_000,
    refetchOnWindowFocus: "always",
    placeholderData: (previous) => previous,
  });
  return {
    ...result,
    data: result.data ?? (result.isFetching ? progress : undefined),
  };
}
