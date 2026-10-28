import type { AutomationEventFilters } from "./types";

export type AutomationEventFacts = {
  projectId: string;
  columnName: string | null;
  labelNames: string[];
};

const same = (a: string, b: string) =>
  a.trim().toLocaleLowerCase() === b.trim().toLocaleLowerCase();

// Columns and labels are matched by name so one workspace-wide automation can
// cover every project that uses the same board or label vocabulary.
export function matchesAutomationFilters(
  filters: AutomationEventFilters,
  facts: AutomationEventFacts,
) {
  if (filters.projectId && filters.projectId !== facts.projectId) return false;
  if (
    filters.columnName &&
    !(facts.columnName && same(filters.columnName, facts.columnName))
  )
    return false;
  if (
    filters.labelName &&
    !facts.labelNames.some((name) => same(name, filters.labelName as string))
  )
    return false;
  return true;
}
