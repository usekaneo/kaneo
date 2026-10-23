import {
  type InfiniteData,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type {
  GlobalBoardFilters,
  GlobalBoardLane,
} from "@/components/global-board/global-board-filters";
import {
  insertIntoLane,
  removeFromLane,
} from "@/components/global-board/move-between-lanes";
import type { GlobalBoardProject } from "@/fetchers/task/get-global-board-meta";
import type {
  GlobalBoardTask,
  GlobalBoardTasksPage,
} from "@/fetchers/task/get-global-board-tasks";
import moveGlobalBoardTask from "@/fetchers/task/move-global-board-task";
import { globalBoardTasksKey } from "@/hooks/queries/task/use-global-board-tasks";
import { invalidateMyWork } from "@/lib/invalidate-my-work";
import { toast } from "@/lib/toast";

type LaneData = InfiniteData<GlobalBoardTasksPage, number>;
type LaneKey = ReturnType<typeof globalBoardTasksKey>;

export type GlobalBoardMove = {
  task: GlobalBoardTask;
  from: GlobalBoardLane;
  to: GlobalBoardLane;
  index: number;
  /** The target lane top to bottom after the move, including the task. */
  visibleIds: string[];
  /** A new project column; omitted for a reorder within the lane. */
  column?: GlobalBoardProject["columns"][number];
};

type Snapshot = { key: LaneKey; data: LaneData | undefined }[];

export function useMoveGlobalBoardTask(
  filters: GlobalBoardFilters,
  { onSettled }: { onSettled?: () => void } = {},
) {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  const mutation = useMutation({
    mutationFn: ({ move }: { move: GlobalBoardMove; snapshot: Snapshot }) =>
      moveGlobalBoardTask({
        taskId: move.task.id,
        visibleTaskIds: move.visibleIds,
        ...(move.column ? { status: move.column.slug } : {}),
      }),
    onError: (_error, { snapshot }) => {
      for (const { key, data } of snapshot) queryClient.setQueryData(key, data);
      toast.error(t("tasks:globalBoard.moveFailed"));
    },
    onSettled: (_result, _error, { move }) => {
      onSettled?.();
      invalidateMyWork(queryClient);
      void queryClient.invalidateQueries({ queryKey: ["task", move.task.id] });
      void queryClient.invalidateQueries({
        queryKey: ["tasks", move.task.projectId],
      });
      if (move.column) {
        void queryClient.invalidateQueries({ queryKey: ["projects"] });
        void queryClient.invalidateQueries({
          queryKey: ["activities", move.task.id],
        });
        void queryClient.invalidateQueries({ queryKey: ["notifications"] });
      }
    },
  });

  // Writes the cache before returning, so a drop and its new order render in
  // the same frame instead of snapping back while the request starts.
  return (move: GlobalBoardMove) => {
    void queryClient.cancelQueries({ queryKey: ["global-board", "tasks"] });
    const keys = [...new Set([move.from, move.to])].map((lane) =>
      globalBoardTasksKey(lane, filters),
    );
    const snapshot = keys.map((key) => ({
      key,
      data: queryClient.getQueryData<LaneData>(key),
    }));
    const moved = move.column
      ? {
          ...move.task,
          status: move.column.slug,
          statusName: move.column.name,
          statusIcon: move.column.icon,
        }
      : move.task;
    queryClient.setQueryData<LaneData>(
      globalBoardTasksKey(move.from, filters),
      (lane) => removeFromLane(lane, move.task.id),
    );
    queryClient.setQueryData<LaneData>(
      globalBoardTasksKey(move.to, filters),
      (lane) => insertIntoLane(lane, moved, move.index),
    );
    mutation.mutate({ move, snapshot });
  };
}
