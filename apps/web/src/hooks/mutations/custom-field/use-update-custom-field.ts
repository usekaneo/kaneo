import { useMutation, useQueryClient } from "@tanstack/react-query";
import updateCustomField from "@/fetchers/custom-field/update-custom-field";
import { HttpError } from "@/lib/http-error";

export default function useUpdateCustomField() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateCustomField,
    onError: async (error) => {
      if (error instanceof HttpError && error.status === 409) {
        await queryClient.invalidateQueries({ queryKey: ["custom-fields"] });
      }
    },
    onSuccess: async (field) => {
      await Promise.all(
        [
          ["custom-fields", field.projectId],
          ["custom-field-values"],
          ["custom-field-filter-values", field.projectId],
        ].map((queryKey) => queryClient.invalidateQueries({ queryKey })),
      );
    },
  });
}
