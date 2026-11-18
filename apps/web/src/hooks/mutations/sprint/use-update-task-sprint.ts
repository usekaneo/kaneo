import { useMutation, useQueryClient } from "@tanstack/react-query";
import updateTaskSprint from "@/fetchers/sprint/update-task-sprint";

export function useUpdateTaskSprint() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      taskId,
      projectId,
      sprintId,
    }: {
      taskId: string;
      projectId: string;
      sprintId: string | null;
    }) => updateTaskSprint(taskId, sprintId),
    onSuccess: async (_, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["task", variables.taskId],
        }),
        queryClient.invalidateQueries({
          queryKey: ["tasks", variables.projectId],
        }),
        queryClient.invalidateQueries({
          queryKey: ["sprints", variables.projectId],
        }),
      ]);
    },
  });
}
