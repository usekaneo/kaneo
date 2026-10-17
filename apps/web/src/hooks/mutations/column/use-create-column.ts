import { useMutation, useQueryClient } from "@tanstack/react-query";
import createColumn from "@/fetchers/column/create-column";
import { forgetCollapsedColumn } from "@/lib/collapsed-sections";

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
    onSuccess: async (column) => {
      forgetCollapsedColumn(column.projectId, column.slug);
      await queryClient.invalidateQueries({ refetchType: "all" });
    },
  });
}
