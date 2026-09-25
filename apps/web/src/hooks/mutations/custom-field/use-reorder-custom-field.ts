import { useMutation, useQueryClient } from "@tanstack/react-query";
import reorderCustomFields from "@/fetchers/custom-field/reorder-custom-field";

export function useReorderCustomFields() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      projectId,
      fields,
    }: {
      projectId: string;
      fields: Array<{ id: string; position: number }>;
    }) => reorderCustomFields(projectId, fields),
    onSuccess: () => {
      void queryClient.invalidateQueries({ refetchType: "all" });
    },
  });
}
