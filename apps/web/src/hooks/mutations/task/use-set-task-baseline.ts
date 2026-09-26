import { useMutation, useQueryClient } from "@tanstack/react-query";
import clearTaskBaseline from "@/fetchers/task/clear-task-baseline";
import setTaskBaseline from "@/fetchers/task/set-task-baseline";
import type Task from "@/types/task";

function invalidateTaskQueries(
  queryClient: ReturnType<typeof useQueryClient>,
  task: Task,
) {
  queryClient.invalidateQueries({ queryKey: ["task", task.id] });
  queryClient.invalidateQueries({ queryKey: ["tasks", task.projectId] });
  queryClient.invalidateQueries({ queryKey: ["projects"] });
}

export function useSetTaskBaseline() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (task: Task) => setTaskBaseline(task.id),
    onSuccess: (_, task) => invalidateTaskQueries(queryClient, task),
  });
}

export function useClearTaskBaseline() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (task: Task) => clearTaskBaseline(task.id),
    onSuccess: (_, task) => invalidateTaskQueries(queryClient, task),
  });
}
