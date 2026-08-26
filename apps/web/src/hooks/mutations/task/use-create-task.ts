import { useMutation, useQueryClient } from "@tanstack/react-query";
import createTask, {
  type CreateTaskRequest,
} from "@/fetchers/task/create-task";

function useCreateTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateTaskRequest) => createTask(input),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({
        queryKey: ["tasks", variables.projectId],
      });
    },
  });
}

export default useCreateTask;
