import { useMutation, useQueryClient } from "@tanstack/react-query";
import deleteHoliday from "@/fetchers/calendar/delete-holiday";

function useDeleteHoliday() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      workspaceId,
      holidayId,
    }: {
      workspaceId: string;
      holidayId: string;
    }) => deleteHoliday(workspaceId, holidayId),
    onSuccess: (_result, { workspaceId }) => {
      void queryClient.invalidateQueries({
        queryKey: ["calendar", workspaceId],
      });
    },
  });
}

export default useDeleteHoliday;
