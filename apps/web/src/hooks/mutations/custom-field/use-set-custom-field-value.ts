import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { SetCustomFieldValueRequest } from "@/fetchers/custom-field/set-custom-field-value";
import setCustomFieldValue from "@/fetchers/custom-field/set-custom-field-value";

type SetCustomFieldValueArgs = SetCustomFieldValueRequest & {
  projectId?: string;
};

function useSetCustomFieldValue() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ taskId, fieldId, value }: SetCustomFieldValueArgs) =>
      setCustomFieldValue({ taskId, fieldId, value }),
    onSuccess: (_data, variables: SetCustomFieldValueArgs) => {
      void queryClient.invalidateQueries({
        queryKey: ["custom-field-values", variables.taskId],
      });
      if (variables.projectId) {
        void queryClient.invalidateQueries({
          queryKey: ["tasks", variables.projectId],
        });
        void queryClient.invalidateQueries({
          queryKey: ["custom-field-filter-values", variables.projectId],
        });
      }
      void queryClient.invalidateQueries({
        queryKey: ["task", variables.taskId],
      });
    },
  });
}

export default useSetCustomFieldValue;
