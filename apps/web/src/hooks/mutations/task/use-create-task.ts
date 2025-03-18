import createTask from "@/fetchers/task/create-task";
import { useMutation } from "@tanstack/react-query";

type CreateTaskInput = {
  title: string;
  description: string;
  userEmail: string;
  projectId: string;
  status: string;
  dueDate: Date;
  number?: number;
  priority: "low" | "medium" | "high" | "urgent";
  position: number;
};

function useCreateTask() {
  return useMutation({
    mutationFn: ({
      title,
      description,
      userEmail,
      projectId,
      status,
      dueDate,
      priority,
      position,
    }: CreateTaskInput) =>
      createTask(
        title,
        description,
        projectId,
        userEmail,
        status,
        dueDate,
        priority,
        position,
      ),
  });
}

export default useCreateTask;
