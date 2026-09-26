import { useMutation, useQueryClient } from "@tanstack/react-query";
import updateWorkingDays from "@/fetchers/calendar/update-working-days";

function useUpdateWorkingDays() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      workspaceId,
      workingDays,
    }: {
      workspaceId: string;
      workingDays: number;
    }) => updateWorkingDays(workspaceId, workingDays),
    onSuccess: (_result, { workspaceId }) => {
      void queryClient.invalidateQueries({
        queryKey: ["calendar", workspaceId],
      });
    },
  });
}

export default useUpdateWorkingDays;
