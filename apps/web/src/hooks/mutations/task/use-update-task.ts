import { useMutation, useQueryClient } from "@tanstack/react-query";
import updateTask from "@/fetchers/task/update-task";
import type Task from "@/types/task";

export function useUpdateTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (task: Task) => updateTask(task.id, task),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["task", variables.id],
      });
      queryClient.invalidateQueries({
        queryKey: ["tasks", variables.projectId],
      });
      queryClient.invalidateQueries({
        queryKey: ["notifications"],
      });
      queryClient.invalidateQueries({
        queryKey: ["projects"],
      });
      queryClient.invalidateQueries({
        queryKey: ["activities", variables.id],
      });
      // A date/milestone edit can change how this task renders as an
      // external (cross-project) row on ANOTHER project's Gantt chart (see
      // use-create-task-relation.ts, which invalidates the same key for the
      // same reason). Which other project(s) relate to this task isn't
      // known here, so every project's task-relations cache is invalidated
      // — broad, but cheap, and only mounted Gantt views actually refetch.
      queryClient.invalidateQueries({
        queryKey: ["task-relations", "project"],
      });
    },
  });
}
