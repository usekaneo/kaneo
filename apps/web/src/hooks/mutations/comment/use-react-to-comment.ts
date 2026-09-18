import { useMutation, useQueryClient } from "@tanstack/react-query";
import reactToComment from "@/fetchers/comment/react-to-comment";

function useReactToComment(taskId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: reactToComment,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["activities", taskId] }),
  });
}

export default useReactToComment;
