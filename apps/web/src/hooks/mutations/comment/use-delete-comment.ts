import deleteComment from "@/fetchers/comment/delete-comment";
import { useMutation, useQueryClient } from "@tanstack/react-query";

function useDeleteComment(taskId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteComment,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["activities", taskId] });
    },
  });
}

export default useDeleteComment;
