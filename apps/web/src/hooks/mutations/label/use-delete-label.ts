import deleteLabel from "@/fetchers/label/delete-label";
import { useMutation } from "@tanstack/react-query";

function useDeleteLabel() {
  return useMutation({
    mutationFn: deleteLabel,
  });
}

export default useDeleteLabel;
