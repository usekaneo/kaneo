import { useMutation, useQueryClient } from "@tanstack/react-query";
import createSprint from "@/fetchers/sprint/create-sprint";

export function useCreateSprint() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      projectId,
      data,
    }: {
      projectId: string;
      data: {
        name?: string;
        goal?: string | null;
        startDate?: string;
        endDate?: string;
      };
    }) => createSprint(projectId, data),
    onSuccess: async (_, variables) => {
      await queryClient.invalidateQueries({
        queryKey: ["sprints", variables.projectId],
        refetchType: "all",
      });
    },
  });
}
