import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import moveTask from "@/fetchers/task/move-task";
import { toast } from "@/lib/toast";

export function useMoveTask() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: moveTask,
    onSuccess: (result, variables) => {
      toast.success(t("tasks:move.success"));
      queryClient.invalidateQueries({
        queryKey: ["task", variables.taskId],
      });
      queryClient.invalidateQueries({
        queryKey: ["tasks", result.sourceProjectId],
      });
      queryClient.invalidateQueries({
        queryKey: ["tasks", result.destinationProjectId],
      });
      // The list view reads relations per project, and moving a task changes
      // which edges are internal to each side. The websocket broadcast skips
      // the window that started the move, so this is the only path that
      // refreshes it for whoever performed it.
      queryClient.invalidateQueries({
        queryKey: ["task-relations", "project", result.sourceProjectId],
      });
      queryClient.invalidateQueries({
        queryKey: ["task-relations", "project", result.destinationProjectId],
      });
      queryClient.invalidateQueries({
        queryKey: ["projects"],
      });
      queryClient.invalidateQueries({
        queryKey: ["activities", variables.taskId],
      });
      queryClient.invalidateQueries({
        queryKey: ["notifications"],
      });
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : t("tasks:move.error"),
      );
    },
  });
}
