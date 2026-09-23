import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { CreateCustomFieldRequest } from "@/fetchers/custom-field/create-custom-field";
import createCustomField from "@/fetchers/custom-field/create-custom-field";

function useCreateCustomField() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createCustomField,
    onSuccess: (created, variables: CreateCustomFieldRequest) => {
      queryClient.setQueryData(
        ["custom-fields", variables.projectId],
        (existing: Array<typeof created> | undefined) => {
          if (!existing) return [created];
          return [...existing, created];
        },
      );

      void queryClient.invalidateQueries({ refetchType: "all" });
    },
  });
}

export default useCreateCustomField;
