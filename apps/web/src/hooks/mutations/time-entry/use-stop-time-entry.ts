import { useMutation, useQueryClient } from "@tanstack/react-query";
import stopTimeEntry from "@/fetchers/time-entry/stop-time-entry";

function useStopTimeEntry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => stopTimeEntry(id),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["time-entries"] }),
  });
}

export default useStopTimeEntry;
