import { useMutation, useQueryClient } from "@tanstack/react-query";
import createHoliday from "@/fetchers/calendar/create-holiday";

function useCreateHoliday() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      workspaceId,
      date,
      name,
    }: {
      workspaceId: string;
      date: string;
      name: string;
    }) => createHoliday(workspaceId, { date, name }),
    onSuccess: (_result, { workspaceId }) => {
      void queryClient.invalidateQueries({
        queryKey: ["calendar", workspaceId],
      });
    },
  });
}

export default useCreateHoliday;
