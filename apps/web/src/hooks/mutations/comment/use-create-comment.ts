import { useMutation, useQueryClient } from "@tanstack/react-query";
import createComment from "@/fetchers/comment/create-comment";

function useCreateComment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createComment,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["workspace-activity"] });
    },
  });
}

export default useCreateComment;
