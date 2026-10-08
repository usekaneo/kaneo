import { useMutation, useQueryClient } from "@tanstack/react-query";
import { invalidateMyWork } from "@/lib/invalidate-my-work";
import createTask, {
  type CreateTaskRequest,
} from "@/fetchers/task/create-task";
import { trackFirstTask } from "@/lib/analytics/activation";

function useCreateTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      title,
      description,
      userId,
      projectId,
      status,
      startDate,
      dueDate,
      priority,
      customFields,
      draftAssetIds,
    }: CreateTaskRequest) =>
      createTask(
        title,
        description,
        projectId,
        userId,
        status,
        startDate ? new Date(startDate) : undefined,
        dueDate ? new Date(dueDate) : undefined,
        priority,
        customFields,
        draftAssetIds,
      ),
    onSuccess: (_data, variables) => {
      invalidateMyWork(queryClient);
      void queryClient.invalidateQueries({ queryKey: ["projects"] });
      trackFirstTask();
      void queryClient.invalidateQueries({
        queryKey: ["tasks", variables.projectId],
      });
      void queryClient.invalidateQueries({
        queryKey: ["custom-field-values", variables.projectId],
      });
    },
  });
}

export default useCreateTask;
