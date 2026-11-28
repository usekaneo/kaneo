import type { WorkspaceBoardQuery } from "@/fetchers/task/get-workspace-board";
import { UNASSIGNED_ASSIGNEE_FILTER } from "@/lib/task-filters/unassigned-assignee-filter";
import type Task from "@/types/task";

type QueryTask = Pick<Task, "projectId" | "status" | "priority" | "dueDate"> & {
  userId?: string | null;
};

function listed(filter: string | undefined, value: string | null | undefined) {
  return !filter || (value != null && filter.split(",").includes(value));
}

/**
 * Whether a task passes the filters the server applied to a workspace board.
 * Returns `undefined` when the client cannot tell: label filters match on
 * label groups only the server resolves.
 */
export function matchesWorkspaceBoardQuery(
  task: QueryTask,
  query: WorkspaceBoardQuery,
): boolean | undefined {
  if (
    !listed(query.projectIds, task.projectId) ||
    !listed(query.status, task.status) ||
    !listed(query.priority, task.priority) ||
    !listed(query.assigneeIds, task.userId ?? UNASSIGNED_ASSIGNEE_FILTER)
  ) {
    return false;
  }
  if (query.dueAfter || query.dueBefore) {
    if (!task.dueDate) return false;
    const due = new Date(task.dueDate).getTime();
    if (
      (query.dueAfter && due < new Date(query.dueAfter).getTime()) ||
      (query.dueBefore && due > new Date(query.dueBefore).getTime())
    ) {
      return false;
    }
  }
  return query.labelIds ? undefined : true;
}
