import { useMutation, useQueryClient } from "@tanstack/react-query";
import deleteTimeEntry from "@/fetchers/time-entry/delete-time-entry";

function useDeleteTimeEntry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteTimeEntry(id),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["time-entries"] }),
  });
}

export default useDeleteTimeEntry;
