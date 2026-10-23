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
  addToLane,
  removeFromLane,
} from "@/components/global-board/move-between-lanes";
import type { GlobalBoardProject } from "@/fetchers/task/get-global-board-meta";
import type {
  GlobalBoardTask,
  GlobalBoardTasksPage,
} from "@/fetchers/task/get-global-board-tasks";
import updateTaskStatus from "@/fetchers/task/update-task-status";
import { globalBoardTasksKey } from "@/hooks/queries/task/use-global-board-tasks";
import { invalidateMyWork } from "@/lib/invalidate-my-work";
import { toast } from "@/lib/toast";

type LaneData = InfiniteData<GlobalBoardTasksPage, number>;

export type GlobalBoardMove = {
  task: GlobalBoardTask;
  from: GlobalBoardLane;
  to: GlobalBoardLane;
  column: GlobalBoardProject["columns"][number];
};

export function useMoveGlobalBoardTask(filters: GlobalBoardFilters) {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: ({ task, column }: GlobalBoardMove) =>
      updateTaskStatus(task.id, { status: column.slug }),
    onMutate: async ({ task, from, to, column }) => {
      const fromKey = globalBoardTasksKey(from, filters);
      const toKey = globalBoardTasksKey(to, filters);
      await queryClient.cancelQueries({ queryKey: ["global-board", "tasks"] });
      const previous = {
        from: queryClient.getQueryData<LaneData>(fromKey),
        to: queryClient.getQueryData<LaneData>(toKey),
      };
      queryClient.setQueryData<LaneData>(fromKey, (lane) =>
        removeFromLane(lane, task.id),
      );
      queryClient.setQueryData<LaneData>(toKey, (lane) =>
        addToLane(lane, {
          ...task,
          status: column.slug,
          statusName: column.name,
          statusIcon: column.icon,
        }),
      );
      return { fromKey, toKey, previous };
    },
    onError: (_error, _move, context) => {
      if (context) {
        queryClient.setQueryData(context.fromKey, context.previous.from);
        queryClient.setQueryData(context.toKey, context.previous.to);
      }
      toast.error(t("tasks:globalBoard.moveFailed"));
    },
    onSettled: (_result, _error, { task }) => {
      invalidateMyWork(queryClient);
      void queryClient.invalidateQueries({ queryKey: ["task", task.id] });
      void queryClient.invalidateQueries({
        queryKey: ["tasks", task.projectId],
      });
      void queryClient.invalidateQueries({ queryKey: ["projects"] });
      void queryClient.invalidateQueries({
        queryKey: ["activities", task.id],
      });
      void queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
}
