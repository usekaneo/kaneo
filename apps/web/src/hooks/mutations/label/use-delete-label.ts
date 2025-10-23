import { useMutation } from "@tanstack/react-query";
import deleteLabel from "@/fetchers/label/delete-label";

function useDeleteLabel() {
  return useMutation({
    mutationFn: deleteLabel,
  });
}

export default useDeleteLabel;
