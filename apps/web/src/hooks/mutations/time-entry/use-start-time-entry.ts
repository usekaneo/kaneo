import { useMutation, useQueryClient } from "@tanstack/react-query";
import startTimeEntry, {
  type StartTimeEntryRequest,
} from "@/fetchers/time-entry/start-time-entry";

function useStartTimeEntry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: StartTimeEntryRequest) => startTimeEntry(data),
    onSuccess: (result) => {
      queryClient.invalidateQueries({
        queryKey: ["time-entries", result.entry.taskId],
      });
      // Always, not just on a task switch: a same-task restart writes an
      // activity row on this task too, and nothing else refreshes that feed
      // for the initiating tab.
      queryClient.invalidateQueries({
        queryKey: ["activities", result.entry.taskId],
      });
      for (const taskId of [result.stoppedTaskId, result.discardedTaskId]) {
        if (taskId && taskId !== result.entry.taskId) {
          queryClient.invalidateQueries({
            queryKey: ["time-entries", taskId],
          });
          queryClient.invalidateQueries({
            queryKey: ["activities", taskId],
          });
        }
      }
      queryClient.invalidateQueries({
        queryKey: ["time-entries", "running", "me"],
      });
    },
  });
}

export default useStartTimeEntry;
