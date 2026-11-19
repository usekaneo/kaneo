import { useMutation, useQueryClient } from "@tanstack/react-query";
import closeSprint from "@/fetchers/sprint/close-sprint";

export function useCloseSprint() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      targetSprintId,
    }: {
      id: string;
      projectId: string;
      targetSprintId: string | null;
    }) => closeSprint(id, targetSprintId),
    onSuccess: async (_, variables) => {
      // Closing moves unfinished tasks, so the board must reload as well.
      await Promise.all([
        queryClient.invalidateQueries({
          // Inactive sprint lists are only marked stale; they refetch on mount.
          queryKey: ["sprints", variables.projectId],
        }),
        queryClient.invalidateQueries({
          queryKey: ["tasks", variables.projectId],
        }),
      ]);
    },
  });
}
