import deleteTask from "@/fetchers/task/delete-task";
import { useMutation } from "@tanstack/react-query";

export function useDeleteTask() {
  return useMutation({
    mutationFn: deleteTask,
  });
}
