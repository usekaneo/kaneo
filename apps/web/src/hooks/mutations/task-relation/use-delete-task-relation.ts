import { useMutation, useQueryClient } from "@tanstack/react-query";
import deleteTaskRelation from "@/fetchers/task-relation/delete-task-relation";

function useDeleteTaskRelation(taskId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteTaskRelation,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["task-relations", taskId],
      });
    },
  });
}

export default useDeleteTaskRelation;
