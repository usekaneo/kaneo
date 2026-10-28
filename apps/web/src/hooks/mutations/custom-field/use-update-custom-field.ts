import { useMutation, useQueryClient } from "@tanstack/react-query";
import updateCustomField, {
  type UpdateCustomFieldRequest,
} from "@/fetchers/custom-field/update-custom-field";

function useUpdateCustomField(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: UpdateCustomFieldRequest;
    }) => updateCustomField(id, data),
    onSuccess: (updated) => {
      queryClient.setQueryData(
        ["custom-fields", projectId],
        (existing: Array<typeof updated> | undefined) =>
          existing?.map((field) => (field.id === updated.id ? updated : field)),
      );

      return Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["custom-fields", projectId],
        }),
        queryClient.invalidateQueries({ queryKey: ["custom-field-values"] }),
        queryClient.invalidateQueries({
          queryKey: ["custom-field-filter-values", projectId],
        }),
        queryClient.invalidateQueries({ queryKey: ["tasks", projectId] }),
        queryClient.invalidateQueries({ queryKey: ["task"] }),
      ]);
    },
  });
}

export default useUpdateCustomField;
