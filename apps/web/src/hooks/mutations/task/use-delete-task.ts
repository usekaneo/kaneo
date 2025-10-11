import { useMutation } from "@tanstack/react-query";
import deleteTask from "@/fetchers/task/delete-task";

export function useDeleteTask() {
  return useMutation({
    mutationFn: deleteTask,
  });
}
