import { useMutation, useQueryClient } from "@tanstack/react-query";
import startSprint from "@/fetchers/sprint/start-sprint";

export function useStartSprint() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      projectId,
      data,
    }: {
      id: string;
      projectId: string;
      data?: { startDate?: string; endDate?: string };
    }) => startSprint(id, data),
    onSuccess: async (_, variables) => {
      await queryClient.invalidateQueries({
        queryKey: ["sprints", variables.projectId],
        refetchType: "all",
      });
    },
  });
}
