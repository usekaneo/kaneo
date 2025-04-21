import updateTimeEntry, {
  type UpdateTimeEntryRequest,
} from "@/fetchers/time-entry/update-time-entry";
import { useMutation, useQueryClient } from "@tanstack/react-query";

function useUpdateTimeEntry(taskId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: UpdateTimeEntryRequest) => updateTimeEntry(data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["time-entries", taskId],
      });
    },
  });
}

export default useUpdateTimeEntry;
