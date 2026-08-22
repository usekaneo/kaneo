import { useQuery } from "@tanstack/react-query";
import getCustomFieldValuesByProject from "@/fetchers/custom-field/get-custom-field-values-by-project";

export type CustomFieldValue = {
  id: string;
  taskId: string;
  fieldId: string;
  value: string | null;
  fieldName: string;
  fieldType: string;
  fieldOptions: unknown;
};

function useGetCustomFieldValuesByProject(projectId: string) {
  return useQuery<CustomFieldValue[]>({
    queryKey: ["custom-field-values", projectId],
    queryFn: () => getCustomFieldValuesByProject({ projectId }),
    enabled: Boolean(projectId),
  });
}

export default useGetCustomFieldValuesByProject;
