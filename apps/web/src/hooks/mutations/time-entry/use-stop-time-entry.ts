import { useMutation, useQueryClient } from "@tanstack/react-query";
import stopTimeEntry from "@/fetchers/time-entry/stop-time-entry";

function useStopTimeEntry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: string | { id: string; description?: string }) =>
      typeof input === "string"
        ? stopTimeEntry(input)
        : stopTimeEntry(input.id, input.description),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["time-entries"] }),
  });
}

export default useStopTimeEntry;
