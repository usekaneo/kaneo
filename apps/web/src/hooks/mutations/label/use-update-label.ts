import { useMutation, useQueryClient } from "@tanstack/react-query";
import updateLabel from "@/fetchers/label/update-label";

function useUpdateLabel() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateLabel,
    onSuccess: (_updatedLabel) => {
      void queryClient.invalidateQueries({
        queryKey: ["labels"],
      });
      void queryClient.invalidateQueries({
        queryKey: ["tasks"],
      });
      void queryClient.invalidateQueries({
        queryKey: ["task"],
      });
    },
  });
}

export default useUpdateLabel;
