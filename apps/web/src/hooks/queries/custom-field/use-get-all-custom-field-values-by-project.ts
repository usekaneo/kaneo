import { useCallback, useMemo } from "react";
import useGetCustomFieldValuesByProject, {
  type CustomFieldValue,
} from "./use-get-custom-field-values-by-project";

function useGetCachedCustomFieldValues(projectId?: string) {
  const query = useGetCustomFieldValuesByProject(projectId ?? "");
  const { data } = query;
  const valuesByTask = useMemo(() => {
    const grouped = new Map<string, CustomFieldValue[]>();
    for (const value of data ?? []) {
      const values = grouped.get(value.taskId) ?? [];
      values.push(value);
      grouped.set(value.taskId, values);
    }
    return grouped;
  }, [data]);

  const getValuesForTask = useCallback(
    (taskId: string) => valuesByTask.get(taskId) ?? [],
    [valuesByTask],
  );

  return {
    getValuesForTask,
    hasData: data !== undefined,
    isLoading: query.isPending,
    isError: query.isError,
    retry: query.refetch,
  };
}

export default useGetCachedCustomFieldValues;
