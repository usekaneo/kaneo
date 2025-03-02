import updateTask from "@/fetchers/task/update-task";
import type { Task } from "@/types/project";
import { useMutation } from "@tanstack/react-query";

function useUpdateTask() {
  return useMutation({
    mutationFn: (task: Task) => updateTask(task.id, task),
  });
}

export default useUpdateTask;
