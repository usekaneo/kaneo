import { useMutation, useQueryClient } from "@tanstack/react-query";
import deleteCustomField from "@/fetchers/custom-field/delete-custom-field";

function useDeleteCustomField(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteCustomField,
    onSuccess: (_data, variables) => {
      queryClient.setQueryData(
        ["custom-fields", projectId],
        (existing: Array<{ id: string }> | undefined) => {
          if (!existing) return [];
          return existing.filter((f) => f.id !== variables.id);
        },
      );

      void queryClient.invalidateQueries({
        queryKey: ["custom-fields", projectId],
      });
    },
  });
}

export default useDeleteCustomField;
