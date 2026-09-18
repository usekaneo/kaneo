import { useMutation, useQueryClient } from "@tanstack/react-query";
import updateTimeEntry, {
  type UpdateTimeEntryRequest,
} from "@/fetchers/time-entry/update-time-entry";

function useUpdateTimeEntry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: UpdateTimeEntryRequest) => updateTimeEntry(data),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["time-entries"] }),
  });
}

export default useUpdateTimeEntry;
