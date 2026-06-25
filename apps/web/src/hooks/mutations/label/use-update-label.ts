import { useMutation, useQueryClient } from "@tanstack/react-query";
import updateLabel from "@/fetchers/label/update-label";

function useUpdateLabel() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateLabel,
    onSuccess: (updatedLabel) => {
      void queryClient.invalidateQueries({
        queryKey: ["labels", updatedLabel.workspaceId],
      });
    },
  });
}

export default useUpdateLabel;
