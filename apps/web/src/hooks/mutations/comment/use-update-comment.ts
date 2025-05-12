import updateComment from "@/fetchers/comment/update-comment";
import { useMutation } from "@tanstack/react-query";

function useUpdateComment() {
  return useMutation({
    mutationFn: updateComment,
  });
}

export default useUpdateComment;
