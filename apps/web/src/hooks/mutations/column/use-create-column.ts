import { useMutation, useQueryClient } from "@tanstack/react-query";
import createColumn from "@/fetchers/column/create-column";

export function useCreateColumn() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      projectId,
      data,
    }: {
      projectId: string;
      data: { name: string; icon?: string; color?: string; isFinal?: boolean };
    }) => createColumn(projectId, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["columns", variables.projectId],
      });
      queryClient.invalidateQueries({
        queryKey: ["tasks"],
      });
    },
  });
}
