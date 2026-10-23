import { getInitialTaskColumn } from "@/components/shared/modals/initial-task-column";

type WorkflowColumn = { slug: string; isFinal: boolean };

/**
 * Where a planned task lands when sent to the board: the To Do column, or
 * else the project's first open column, as when creating a task.
 */
export function boardEntryColumn<T extends WorkflowColumn>(
  columns: T[] | undefined,
): T | undefined {
  return (
    columns?.find((column) => column.slug === "to-do" && !column.isFinal) ??
    getInitialTaskColumn(columns)
  );
}
