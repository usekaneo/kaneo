import type { BoardData, BoardTask } from "@/lib/api/types";
import { isOverdue } from "@/lib/format";
import { STATUS_ARCHIVED, STATUS_PLANNED } from "@/lib/style";

export const UNASSIGNED = "__unassigned__";

export type BoardFilters = {
  query: string;
  assignees: string[];
  priorities: string[];
  labels: string[];
  overdueOnly: boolean;
};

export const emptyFilters: BoardFilters = {
  query: "",
  assignees: [],
  priorities: [],
  labels: [],
  overdueOnly: false,
};

export function filterCount(f: BoardFilters) {
  return (
    f.assignees.length +
    f.priorities.length +
    f.labels.length +
    (f.overdueOnly ? 1 : 0)
  );
}

export function matches(f: BoardFilters, task: BoardTask): boolean {
  const q = f.query.trim();
  if (q) {
    const inTitle = task.title.toLowerCase().includes(q.toLowerCase());
    const inNumber =
      String(task.number ?? "") ===
      q.replace(/^#/, "").replace(/^[A-Za-z]+-/, "");
    if (!inTitle && !inNumber) return false;
  }
  if (f.assignees.length) {
    const key = task.assigneeId ?? task.userId ?? UNASSIGNED;
    if (!f.assignees.includes(key)) return false;
  }
  if (
    f.priorities.length &&
    !f.priorities.includes(task.priority ?? "no-priority")
  )
    return false;
  if (
    f.labels.length &&
    !(task.labels ?? []).some((l) => f.labels.includes(l.name))
  )
    return false;
  if (f.overdueOnly && !isOverdue(task.dueDate)) return false;
  return true;
}

/** One swipeable page of the board: a workflow column, or the virtual backlog/archive lists. */
export type Lane = {
  status: string;
  name: string;
  icon?: string | null;
  isFinal: boolean;
  tasks: BoardTask[];
  total: number;
};

export function lanes(
  data: BoardData,
  f: BoardFilters,
  backlog: boolean,
  archived: boolean,
): Lane[] {
  const cols = data.columns ?? [];
  const out: Lane[] = [];
  if (backlog)
    out.push({
      status: STATUS_PLANNED,
      name: "Backlog",
      isFinal: false,
      tasks: data.plannedTasks.filter((t) => matches(f, t)),
      total: data.plannedTasks.length,
    });
  cols.forEach((col) => {
    const tasks = col.tasks ?? [];
    out.push({
      status: col.slug,
      name: col.name,
      icon: col.icon,
      isFinal: !!col.isFinal,
      tasks: tasks.filter((t) => matches(f, t)),
      total: tasks.length,
    });
  });
  if (archived)
    out.push({
      status: STATUS_ARCHIVED,
      name: "Archived",
      isFinal: false,
      tasks: data.archivedTasks.filter((t) => matches(f, t)),
      total: data.archivedTasks.length,
    });
  return out;
}
