import { useMutation } from "@tanstack/react-query";
import updateComment from "@/fetchers/comment/update-comment";

function useUpdateComment() {
  return useMutation({
    mutationFn: updateComment,
  });
}

export default useUpdateComment;
