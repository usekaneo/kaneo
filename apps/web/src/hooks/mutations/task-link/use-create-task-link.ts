import createTaskLink from "@/fetchers/task-link/create-task-link";
import type { TaskLinkType } from "@/types/task-link";
import { useMutation, useQueryClient } from "@tanstack/react-query";

function useCreateTaskLink() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      taskId,
      targetTaskId,
      type,
    }: {
      taskId: string;
      targetTaskId: string;
      type: TaskLinkType;
    }) => createTaskLink(taskId, targetTaskId, type),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["task-links", variables.taskId],
      });
    },
  });
}

export default useCreateTaskLink;
