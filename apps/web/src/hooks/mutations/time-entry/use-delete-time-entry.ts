import { useMutation, useQueryClient } from "@tanstack/react-query";
import deleteTimeEntry from "@/fetchers/time-entry/delete-time-entry";

function useDeleteTimeEntry(taskId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteTimeEntry(id),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["time-entries", taskId],
      });
      queryClient.invalidateQueries({
        queryKey: ["activities", taskId],
      });
    },
  });
}

export default useDeleteTimeEntry;
