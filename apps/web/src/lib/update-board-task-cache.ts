import type { QueryClient } from "@tanstack/react-query";
import type { ProjectWithTasks } from "@/types/project";
import type Task from "@/types/task";
import {
  getBoardCacheVersion,
  markBoardCacheChanged,
} from "./board-cache-version";
import { patchBoardTask } from "./patch-board-task";

export function updateBoardTaskCache(
  queryClient: QueryClient,
  projectId: string,
  taskId: string,
  fields: Partial<Task>,
  expectedVersion?: string,
) {
  if (expectedVersion === undefined)
    markBoardCacheChanged(queryClient, projectId, taskId);
  const version =
    expectedVersion ?? getBoardCacheVersion(queryClient, projectId, taskId);
  const queryKey = ["tasks", projectId];
  const apply = () => {
    if (getBoardCacheVersion(queryClient, projectId, taskId) !== version) {
      void queryClient.invalidateQueries({ queryKey });
      return;
    }
    queryClient.setQueryData<ProjectWithTasks>(queryKey, (board) =>
      board
        ? (patchBoardTask(board, taskId, { ...fields, projectId }) ?? board)
        : board,
    );
  };
  if (queryClient.getQueryState(queryKey)?.fetchStatus === "fetching") {
    const unsubscribe = queryClient
      .getQueryCache()
      .subscribe(({ query, type }) => {
        if (query.queryKey[0] !== "tasks" || query.queryKey[1] !== projectId)
          return;
        if (type === "removed" || query.state.fetchStatus === "idle") {
          unsubscribe();
          if (type !== "removed") apply();
        }
      });
  } else apply();
}
