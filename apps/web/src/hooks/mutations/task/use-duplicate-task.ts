import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import duplicateTask from "@/fetchers/task/duplicate-task";
import { toast } from "@/lib/toast";

export function useDuplicateTask() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: duplicateTask,
    onSuccess: (task) => {
      toast.success(t("tasks:duplicate.success"));
      queryClient.invalidateQueries({
        queryKey: ["tasks", task.projectId],
      });
      // Duplicating a subtask attaches the copy to the same parents, so any open
      // relation list is stale even though the copy is not the task we know about.
      queryClient.invalidateQueries({
        queryKey: ["task-relations"],
      });
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : t("tasks:duplicate.error"),
      );
    },
  });
}
