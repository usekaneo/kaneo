import deleteTaskLink from "@/fetchers/task-link/delete-task-link";
import { useMutation, useQueryClient } from "@tanstack/react-query";

function useDeleteTaskLink() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ taskId, linkId }: { taskId: string; linkId: string }) =>
      deleteTaskLink(taskId, linkId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["task-links", variables.taskId],
      });
    },
  });
}

export default useDeleteTaskLink;
