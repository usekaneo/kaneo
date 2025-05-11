import createComment from "@/fetchers/comment/create-comment";
import { useMutation } from "@tanstack/react-query";

function useCreateComment() {
  return useMutation({
    mutationFn: createComment,
  });
}

export default useCreateComment;
