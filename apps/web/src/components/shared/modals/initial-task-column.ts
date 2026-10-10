import { getSelectableTaskColumns } from "./selectable-task-columns";

type WorkflowColumn = { slug: string; isFinal: boolean };

export function getInitialTaskColumn<T extends WorkflowColumn>(
  columns: T[] | undefined,
  status?: string,
): T | undefined {
  if (status) return columns?.find((column) => column.slug === status);
  return getSelectableTaskColumns(columns).find((column) => !column.isFinal);
}
