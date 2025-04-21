import createTimeEntry, {
  type CreateTimeEntryRequest,
} from "@/fetchers/time-entry/create-time-entry";
import { useMutation, useQueryClient } from "@tanstack/react-query";

function useCreateTimeEntry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateTimeEntryRequest) => createTimeEntry(data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["time-entries", variables.taskId],
      });
    },
  });
}

export default useCreateTimeEntry;
