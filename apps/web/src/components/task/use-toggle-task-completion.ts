import { useTranslation } from "react-i18next";
import getColumns from "@/fetchers/column/get-columns";
import { useUpdateTaskStatus } from "@/hooks/mutations/task/use-update-task-status";
import { toast } from "@/lib/toast";
import queryClient from "@/query-client";
import type Task from "@/types/task";

export function useToggleTaskCompletion() {
  const { t } = useTranslation();
  const { mutateAsync: updateTaskStatus } = useUpdateTaskStatus();

  return async (task: Task) => {
    try {
      const columns = await queryClient.fetchQuery({
        queryKey: ["columns", task.projectId],
        queryFn: () => getColumns(task.projectId),
        staleTime: 0,
      });
      const completed = columns.some(
        (column) => column.slug === task.status && column.isFinal,
      );
      const nextColumn = columns.find((column) => column.isFinal !== completed);
      if (!nextColumn) {
        toast.error(t("tasks:subtasks.noCompletionColumn"));
        return;
      }
      await updateTaskStatus({ ...task, status: nextColumn.slug });
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("tasks:popover.status.updateError"),
      );
    }
  };
}
