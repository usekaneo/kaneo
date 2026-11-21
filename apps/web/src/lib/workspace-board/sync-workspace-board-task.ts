import type { QueryClient } from "@tanstack/react-query";
import getLabelsByTask from "@/fetchers/label/get-labels-by-task";
import type { WorkspaceBoardQuery } from "@/fetchers/task/get-workspace-board";
import getTask from "@/fetchers/task/get-task";
import { HttpError } from "@/lib/http-error";
import type Task from "@/types/task";
import { patchWorkspaceBoardTask } from "./patch-workspace-board-task";
import {
  hasActiveWorkspaceBoards,
  updateActiveWorkspaceBoards,
  WORKSPACE_BOARD_KEY,
} from "./update-active-workspace-boards";

type SyncOptions = {
  /** Re-read the task from the server after applying the known fields. */
  refresh?: boolean;
};

// Later edits of the same task win over earlier reads still in flight.
const sequences = new WeakMap<QueryClient, Map<string, number>>();

function nextSequence(queryClient: QueryClient, taskId: string) {
  const map = sequences.get(queryClient) ?? new Map<string, number>();
  sequences.set(queryClient, map);
  const sequence = (map.get(taskId) ?? 0) + 1;
  map.set(taskId, sequence);
  return sequence;
}

// See workspaceBoardQueryKey: the query is the third part of the key.
function queryOf(queryKey: readonly unknown[]) {
  const query = queryKey[2];
  return typeof query === "object" && query !== null
    ? (query as WorkspaceBoardQuery)
    : undefined;
}

function applyToBoards(
  queryClient: QueryClient,
  taskId: string,
  update?: Partial<Task>,
) {
  updateActiveWorkspaceBoards(queryClient, (board, queryKey) =>
    patchWorkspaceBoardTask(board, taskId, update, {
      query: queryOf(queryKey),
    }),
  );
}

export function removeWorkspaceBoardTask(
  queryClient: QueryClient,
  taskId: string,
) {
  nextSequence(queryClient, taskId);
  applyToBoards(queryClient, taskId);
}

/**
 * Keep the workspace boards on screen current after a task mutation without
 * reloading the whole merged board: apply the fields the caller already
 * knows, then read the task once so server-side fields (position, assignee
 * name, labels) match.
 */
export function syncWorkspaceBoardTask(
  queryClient: QueryClient,
  task: { id: string; projectId: string },
  fields?: Partial<Task>,
  options: SyncOptions = {},
) {
  if (!hasActiveWorkspaceBoards(queryClient)) return;
  const sequence = nextSequence(queryClient, task.id);
  if (fields) applyToBoards(queryClient, task.id, fields);
  if (options.refresh === false) return;

  void Promise.all([
    getTask(task.id, "board"),
    getLabelsByTask({ taskId: task.id }),
  ])
    .then(([fresh, labels]) => {
      if (sequences.get(queryClient)?.get(task.id) !== sequence) return;
      applyToBoards(queryClient, task.id, { ...fresh, labels });
    })
    .catch((error: unknown) => {
      if (sequences.get(queryClient)?.get(task.id) !== sequence) return;
      if (error instanceof HttpError && error.status === 404) {
        applyToBoards(queryClient, task.id);
        return;
      }
      void queryClient.invalidateQueries({ queryKey: WORKSPACE_BOARD_KEY });
    });
}
