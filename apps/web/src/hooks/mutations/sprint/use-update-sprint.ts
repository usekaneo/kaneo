import { useMutation, useQueryClient } from "@tanstack/react-query";
import updateSprint from "@/fetchers/sprint/update-sprint";

export function useUpdateSprint() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      projectId: string;
      data: {
        name?: string;
        goal?: string | null;
        startDate?: string;
        endDate?: string | null;
      };
    }) => updateSprint(id, data),
    onSuccess: async (_, variables) => {
      await queryClient.invalidateQueries({
        // Inactive sprint lists are only marked stale; they refetch on mount.
        queryKey: ["sprints", variables.projectId],
      });
    },
  });
}
