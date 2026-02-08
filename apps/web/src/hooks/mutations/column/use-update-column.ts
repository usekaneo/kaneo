import { useMutation, useQueryClient } from "@tanstack/react-query";
import updateColumn from "@/fetchers/column/update-column";

export function useUpdateColumn() {
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
        icon?: string | null;
        color?: string | null;
        isFinal?: boolean;
      };
    }) => updateColumn(id, data),
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
