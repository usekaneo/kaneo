import { useMutation, useQueryClient } from "@tanstack/react-query";
import createTimeEntry, {
  type CreateTimeEntryRequest,
} from "@/fetchers/time-entry/create-time-entry";

function useCreateTimeEntry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateTimeEntryRequest) => createTimeEntry(data),
    // Starting a timer can stop another one anywhere, so refresh every view.
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["time-entries"] }),
  });
}

export default useCreateTimeEntry;
