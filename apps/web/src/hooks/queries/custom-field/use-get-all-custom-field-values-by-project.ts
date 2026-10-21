import { useCallback, useMemo } from "react";
import useGetCustomFieldValuesByProject, {
  type CustomFieldValue,
} from "./use-get-custom-field-values-by-project";

function useGetCachedCustomFieldValues(projectId?: string) {
  const { data } = useGetCustomFieldValuesByProject(projectId ?? "");
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

  return { getValuesForTask };
}

export default useGetCachedCustomFieldValues;
