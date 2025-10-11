import { useMutation } from "@tanstack/react-query";
import createComment from "@/fetchers/comment/create-comment";

function useCreateComment() {
  return useMutation({
    mutationFn: createComment,
  });
}

export default useCreateComment;
