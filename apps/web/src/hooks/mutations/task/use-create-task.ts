import { useMutation } from "@tanstack/react-query";
import createTask, {
  type CreateTaskRequest,
} from "@/fetchers/task/create-task";

function useCreateTask() {
  return useMutation({
    mutationFn: ({
      title,
      description,
      userId,
      projectId,
      status,
      startDate,
      dueDate,
      priority,
    }: CreateTaskRequest) =>
      createTask(
        title,
        description,
        projectId,
        userId ?? "",
        status,
        startDate ? new Date(startDate) : undefined,
        dueDate ? new Date(dueDate) : undefined,
        priority,
      ),
  });
}

export default useCreateTask;
