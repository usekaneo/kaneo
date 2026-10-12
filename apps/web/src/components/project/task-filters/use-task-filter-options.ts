import { useMemo } from "react";
import type { CustomFieldDefinition } from "@/components/project/custom-fields/types";
import useGetCustomFieldFilterValues from "@/hooks/queries/custom-field/use-get-custom-field-filter-values";
import useGetCustomFieldsByProject from "@/hooks/queries/custom-field/use-get-custom-fields-by-project";
import useGetLabelsByWorkspace from "@/hooks/queries/label/use-get-labels-by-workspace";
import { useGetActiveWorkspaceUsers } from "@/hooks/queries/workspace-users/use-get-active-workspace-users";

export type TaskFilterOptions = ReturnType<typeof useTaskFilterOptions>;

export function useTaskFilterOptions(projectId: string, workspaceId: string) {
  const { data: users } = useGetActiveWorkspaceUsers(workspaceId);
  const { data: labels = [] } = useGetLabelsByWorkspace(workspaceId);
  const { data: rawCustomFields = [] } = useGetCustomFieldsByProject(projectId);
  const { data: filterValues = [] } = useGetCustomFieldFilterValues(projectId);

  const customFields = useMemo<CustomFieldDefinition[]>(
    () =>
      rawCustomFields.map((field, index) => ({
        ...field,
        type: field.type as CustomFieldDefinition["type"],
        options: Array.isArray(field.options)
          ? (field.options as string[])
          : null,
        position: index,
      })),
    [rawCustomFields],
  );

  const usedCustomFieldValues = useMemo<Record<string, string[]>>(
    () => Object.fromEntries(filterValues.map((f) => [f.fieldId, f.values])),
    [filterValues],
  );

  return {
    members: users?.members ?? [],
    labels,
    customFields,
    usedCustomFieldValues,
  };
}
