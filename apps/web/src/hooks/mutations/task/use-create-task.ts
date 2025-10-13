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
      dueDate,
      priority,
    }: CreateTaskRequest) =>
      createTask(
        title,
        description,
        projectId,
        userId ?? "",
        status,
        dueDate ? new Date(dueDate) : undefined,
        priority,
      ),
  });
}

export default useCreateTask;
