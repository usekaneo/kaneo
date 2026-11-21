import type { Query, QueryClient } from "@tanstack/react-query";
import type { ProjectWithTasks } from "@/types/project";

export const WORKSPACE_BOARD_KEY = ["workspace-board"] as const;

// A board nobody is looking at reloads when it mounts again
// (refetchOnMount: "always"), so only boards on screen are kept current.
function activeBoards(queryClient: QueryClient) {
  return queryClient
    .getQueryCache()
    .findAll({ queryKey: WORKSPACE_BOARD_KEY })
    .filter((query) => query.getObserversCount() > 0);
}

// Like the project board cache helpers, wait for a running load instead of
// cancelling it: the load keeps its newer data and the change lands on top.
function whenSettled(
  queryClient: QueryClient,
  query: Query,
  apply: () => void,
) {
  if (query.state.fetchStatus !== "fetching") {
    apply();
    return;
  }
  const unsubscribe = queryClient
    .getQueryCache()
    .subscribe(({ query: changed, type }) => {
      if (changed !== query) return;
      if (type === "removed" || changed.state.fetchStatus === "idle") {
        unsubscribe();
        if (type !== "removed") apply();
      }
    });
}

/**
 * Apply a change to every workspace board on screen. `update` returns the new
 * board, or `null` when the change cannot be applied, which reloads that board.
 */
export function updateActiveWorkspaceBoards(
  queryClient: QueryClient,
  update: (
    board: ProjectWithTasks,
    queryKey: readonly unknown[],
  ) => ProjectWithTasks | null,
) {
  for (const query of activeBoards(queryClient)) {
    whenSettled(queryClient, query, () => {
      const board = queryClient.getQueryData<ProjectWithTasks>(query.queryKey);
      if (!board) return;
      const next = update(board, query.queryKey);
      if (next === null) {
        void queryClient.invalidateQueries({ queryKey: query.queryKey });
        return;
      }
      if (next !== board) queryClient.setQueryData(query.queryKey, next);
    });
  }
}

export function hasActiveWorkspaceBoards(queryClient: QueryClient) {
  return activeBoards(queryClient).length > 0;
}
