import { useMutation, useQueryClient } from "@tanstack/react-query";
import reorderSprints from "@/fetchers/sprint/reorder-sprints";

export function useReorderSprints() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      projectId,
      sprints,
    }: {
      projectId: string;
      sprints: Array<{ id: string; position: number }>;
    }) => reorderSprints(projectId, sprints),
    onSuccess: async (_, variables) => {
      await queryClient.invalidateQueries({
        queryKey: ["sprints", variables.projectId],
        refetchType: "all",
      });
    },
  });
}
