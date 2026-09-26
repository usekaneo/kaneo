import { type Dispatch, type SetStateAction, useEffect } from "react";
import useGetCustomFieldsByProject from "./queries/custom-field/use-get-custom-fields-by-project";
import type { BoardFilters } from "./use-task-filters";

// Reconcile on load as well as refetch, including edits made while this client was offline.
export function useValidCustomFieldFilters(
  projectId: string | undefined,
  setFilters: Dispatch<SetStateAction<BoardFilters>>,
) {
  const { data: fields } = useGetCustomFieldsByProject(projectId ?? "");
  useEffect(() => {
    if (!fields) return;
    setFilters((previous) => {
      const customFields = reconcileCustomFieldFilters(
        previous.customFields,
        fields,
      );
      return customFields === previous.customFields
        ? previous
        : { ...previous, customFields };
    });
  }, [fields, setFilters]);
}

export function reconcileCustomFieldFilters(
  current: Record<string, string[]> | null,
  fields: { id: string; type: string; options: unknown }[],
): Record<string, string[]> | null {
  if (!current) return current;
  const next = Object.fromEntries(
    Object.entries(current).flatMap(([id, values]) => {
      const field = fields.find((candidate) => candidate.id === id);
      if (!field || !Array.isArray(values)) return [];
      const options = field.options;
      const valid =
        (field.type === "dropdown" || field.type === "multiselect") &&
        Array.isArray(options)
          ? values.filter((value) => options.includes(value))
          : values;
      return valid.length ? [[id, valid]] : [];
    }),
  );
  if (JSON.stringify(next) === JSON.stringify(current)) return current;
  return Object.keys(next).length ? next : null;
}
