import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

function useGetCachedCustomFieldValues() {
  const queryClient = useQueryClient();

  const getValuesForTask = useCallback(
    (taskId: string) => {
      return (
        (queryClient.getQueryData(["custom-field-values", taskId]) as
          | Array<{ fieldId: string; value: string | null }>
          | undefined) ?? []
      );
    },
    [queryClient],
  );

  return { getValuesForTask };
}

export default useGetCachedCustomFieldValues;