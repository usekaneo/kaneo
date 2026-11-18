import { useMutation, useQueryClient } from "@tanstack/react-query";
import updateSprint from "@/fetchers/sprint/update-sprint";

export function useUpdateSprint() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      projectId,
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
        queryKey: ["sprints", variables.projectId],
        refetchType: "all",
      });
    },
  });
}
