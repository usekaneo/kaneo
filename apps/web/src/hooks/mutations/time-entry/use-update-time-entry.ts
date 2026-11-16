import { useMutation, useQueryClient } from "@tanstack/react-query";
import type getTimeEntriesByTaskId from "@/fetchers/time-entry/get-time-entries";
import updateTimeEntry, {
  type UpdateTimeEntryRequest,
} from "@/fetchers/time-entry/update-time-entry";

function useUpdateTimeEntry(taskId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: UpdateTimeEntryRequest) => updateTimeEntry(data),
    onSuccess: (updatedEntry) => {
      queryClient.setQueryData<
        Awaited<ReturnType<typeof getTimeEntriesByTaskId>>
      >(["time-entries", taskId], (entries) =>
        entries?.map((entry) =>
          entry.id === updatedEntry.id ? { ...entry, ...updatedEntry } : entry,
        ),
      );
      queryClient.invalidateQueries({
        queryKey: ["time-entries", taskId],
      });
    },
  });
}

export default useUpdateTimeEntry;
