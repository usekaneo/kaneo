import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import reorderTasks, { type TaskReorder } from "@/fetchers/task/reorder-tasks";
import { rollbackBoardReorder } from "@/components/kanban-board/apply-reorder";
import { invalidateMyWork } from "@/lib/invalidate-my-work";
import { toast } from "@/lib/toast";
import useProjectStore from "@/store/project";
import type { ProjectWithTasks } from "@/types/project";

export function useReorderTasks() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: ({
      previousBoard: _previousBoard,
      ...request
    }: TaskReorder & { previousBoard: ProjectWithTasks }) =>
      reorderTasks(request),
    onSuccess: (_result, variables) => {
      if (variables.tasks.some((task) => task.status !== undefined)) {
        invalidateMyWork(queryClient);
        void queryClient.invalidateQueries({ queryKey: ["projects"] });
      }
      void queryClient.invalidateQueries({
        queryKey: ["tasks", variables.projectId],
      });
      for (const task of variables.tasks)
        void queryClient.invalidateQueries({ queryKey: ["task", task.id] });
    },
    onError: (_error, { projectId, previousBoard, tasks }) => {
      const queryKey = ["tasks", projectId];
      const current = queryClient.getQueryData<ProjectWithTasks>(queryKey);
      const restored = current
        ? rollbackBoardReorder(current, previousBoard, tasks)
        : null;
      if (restored) {
        queryClient.setQueryData(queryKey, restored);
        const { project, setProject } = useProjectStore.getState();
        if (project?.id === projectId) setProject(restored);
      }
      toast.error(t("tasks:board.reorderFailed"));
      void queryClient.invalidateQueries({ queryKey });
    },
  });
}
