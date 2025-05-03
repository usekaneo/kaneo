import deleteTask from "@/fetchers/task/delete-task";
import { useMutation } from "@tanstack/react-query";

function useDeleteTask() {
  return useMutation({
    mutationFn: deleteTask,
  });
}

export default useDeleteTask;
