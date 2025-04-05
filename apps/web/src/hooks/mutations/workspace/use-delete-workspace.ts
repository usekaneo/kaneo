import deleteWorkspace from "@/fetchers/workspace/delete-workspace";
import { useMutation } from "@tanstack/react-query";

function useDeleteWorkspace() {
  return useMutation({
    mutationFn: deleteWorkspace,
  });
}

export default useDeleteWorkspace;
