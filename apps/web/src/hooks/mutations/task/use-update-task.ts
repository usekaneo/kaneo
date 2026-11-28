import type { TaskChanges } from "@kaneo/plugin-sdk/web";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { invalidateMyWork } from "@/lib/invalidate-my-work";
import { patchTask } from "@/fetchers/task/patch-task";
import updateTask from "@/fetchers/task/update-task";
import type Task from "@/types/task";

export function useUpdateTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: Task | { taskId: string; changes: TaskChanges }) =>
      "changes" in input
        ? patchTask(input.taskId, input.changes)
        : updateTask(input.id, input),
    onSuccess: (task) => {
      invalidateMyWork(queryClient);
      queryClient.invalidateQueries({
        queryKey: ["task", task.id],
      });
      queryClient.invalidateQueries({
        queryKey: ["tasks", task.projectId],
      });
      queryClient.invalidateQueries({
        queryKey: ["notifications"],
      });
      queryClient.invalidateQueries({
        queryKey: ["projects"],
      });
      queryClient.invalidateQueries({
        queryKey: ["activities", task.id],
      });
    },
  });
}
