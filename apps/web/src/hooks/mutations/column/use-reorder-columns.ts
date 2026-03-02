import { useMutation, useQueryClient } from "@tanstack/react-query";
import reorderColumns from "@/fetchers/column/reorder-columns";

export function useReorderColumns() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      projectId,
      columns,
    }: {
      projectId: string;
      columns: Array<{ id: string; position: number }>;
    }) => reorderColumns(projectId, columns),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ refetchType: "all" });
    },
  });
}
