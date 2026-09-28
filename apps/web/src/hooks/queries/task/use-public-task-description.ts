import { useQuery } from "@tanstack/react-query";
import { getPublicTaskDescription } from "@/fetchers/task/get-description-pages";
import type Task from "@/types/task";

export function usePublicTaskDescription(task: Task | null, open: boolean) {
  return useQuery({
    queryKey: ["public-task-description", task?.projectId, task?.id],
    queryFn: ({ signal }) => {
      if (!task) throw new Error("No task selected");
      return getPublicTaskDescription(task.projectId, task.id, signal);
    },
    enabled: open && !!task?.descriptionDeferred,
    refetchOnMount: "always",
    staleTime: 0,
    gcTime: 0,
    retry: false,
  });
}
