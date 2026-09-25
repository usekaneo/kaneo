import { useMutation, useQueryClient } from "@tanstack/react-query";
import stopTimeEntry from "@/fetchers/time-entry/stop-time-entry";

function useStopTimeEntry(taskId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => stopTimeEntry(taskId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["time-entries", taskId],
      });
      queryClient.invalidateQueries({
        queryKey: ["time-entries", "running", "me"],
      });
      queryClient.invalidateQueries({
        queryKey: ["activities", taskId],
      });
    },
  });
}

export default useStopTimeEntry;
