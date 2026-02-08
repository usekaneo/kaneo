import { useMutation, useQueryClient } from "@tanstack/react-query";
import deleteColumn from "@/fetchers/column/delete-column";

export function useDeleteColumn() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id }: { id: string; projectId: string }) => deleteColumn(id),
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
