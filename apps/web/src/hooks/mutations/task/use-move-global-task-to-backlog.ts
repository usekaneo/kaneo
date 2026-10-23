import {
  type InfiniteData,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { Clock } from "lucide-react";
import { useTranslation } from "react-i18next";
import { removeFromLane } from "@/components/global-board/move-between-lanes";
import type {
  GlobalBoardTask,
  GlobalBoardTasksPage,
} from "@/fetchers/task/get-global-board-tasks";
import updateTaskStatus from "@/fetchers/task/update-task-status";
import { invalidateMyWork } from "@/lib/invalidate-my-work";
import { toast } from "@/lib/toast";

type LaneData = InfiniteData<GlobalBoardTasksPage, number>;

// The backlog is off the board, so the card leaves every lane at once.
export function useMoveGlobalTaskToBacklog() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  const { mutate } = useMutation({
    mutationFn: (task: GlobalBoardTask) =>
      updateTaskStatus(task.id, { status: "planned" }),
    onMutate: async (task) => {
      await queryClient.cancelQueries({ queryKey: ["global-board", "tasks"] });
      const snapshot = queryClient.getQueriesData<LaneData>({
        queryKey: ["global-board", "tasks"],
      });
      queryClient.setQueriesData<LaneData>(
        { queryKey: ["global-board", "tasks"] },
        (lane) => removeFromLane(lane, task.id),
      );
      return { snapshot };
    },
    onSuccess: () =>
      toast.success(t("tasks:actions.movedToBacklog"), { icon: Clock }),
    onError: (_error, _task, context) => {
      for (const [key, data] of context?.snapshot ?? [])
        queryClient.setQueryData(key, data);
      toast.error(t("tasks:globalBoard.moveFailed"));
    },
    onSettled: (_result, _error, task) => {
      invalidateMyWork(queryClient);
      void queryClient.invalidateQueries({ queryKey: ["task", task.id] });
      void queryClient.invalidateQueries({
        queryKey: ["tasks", task.projectId],
      });
      void queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
  });

  return mutate;
}
