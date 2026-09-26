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
      if (!previous.customFields) return previous;
      const next = Object.fromEntries(
        Object.entries(previous.customFields).flatMap(([id, values]) => {
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
      if (JSON.stringify(next) === JSON.stringify(previous.customFields))
        return previous;
      return {
        ...previous,
        customFields: Object.keys(next).length ? next : null,
      };
    });
  }, [fields, setFilters]);
}
