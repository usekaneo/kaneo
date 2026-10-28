import { Result } from "effect";
import type { BoardTask } from "../api/schemas.js";
import { InvalidArgument } from "../errors/errors.js";
import type { BoardColumnSummary, TaskSortField } from "./load-board.js";
import { parseDateInput } from "./parse-date.js";

export const SORT_FIELDS = [
  "created",
  "priority",
  "due",
  "position",
  "title",
  "number",
] as const;
export type SortField = (typeof SORT_FIELDS)[number];

export const SORT_ORDERS = ["asc", "desc"] as const;
export type SortOrder = (typeof SORT_ORDERS)[number];

const API_SORT: Readonly<Record<SortField, TaskSortField>> = {
  created: "createdAt",
  priority: "priority",
  due: "dueDate",
  position: "position",
  title: "title",
  number: "number",
};

export type TaskSort = {
  readonly sortBy: TaskSortField;
  readonly sortOrder: SortOrder;
};

export function toTaskSort(
  field: SortField | undefined,
  order: SortOrder | undefined,
): Result.Result<TaskSort | undefined, InvalidArgument> {
  if (field === undefined) {
    return order === undefined
      ? Result.succeed(undefined)
      : Result.fail(
          new InvalidArgument({
            message: "--order needs --sort.",
            hint: "Pass --sort created, priority, due, position, title or number.",
          }),
        );
  }
  const fallback: SortOrder =
    field === "priority" || field === "created" ? "desc" : "asc";
  return Result.succeed({
    sortBy: API_SORT[field],
    sortOrder: order ?? fallback,
  });
}

export function dueBound(
  input: string,
  now: Date,
  edge: "before" | "after",
): Result.Result<string, InvalidArgument> {
  const flag = edge === "before" ? "--due-before" : "--due-after";
  return Result.map(parseDateInput(input, now, flag), (iso) => {
    const day = new Date(iso);
    const bound =
      edge === "before"
        ? new Date(
            day.getFullYear(),
            day.getMonth(),
            day.getDate(),
            23,
            59,
            59,
            999,
          )
        : new Date(day.getFullYear(), day.getMonth(), day.getDate());
    return bound.toISOString();
  });
}

export function checkDueWindow(
  after: string | undefined,
  before: string | undefined,
): Result.Result<void, InvalidArgument> {
  if (after && before && new Date(after) > new Date(before)) {
    return Result.fail(
      new InvalidArgument({
        message: "--due-after is later than --due-before.",
        hint: "Pick a --due-after date on or before the --due-before date.",
      }),
    );
  }
  return Result.succeed(undefined);
}

function normalizeLabel(name: string): string {
  return name.normalize("NFKC").trim().toLowerCase();
}

export function hasLabels(
  task: Pick<BoardTask, "labels">,
  wanted: ReadonlyArray<string>,
): boolean {
  if (wanted.length === 0) return true;
  const names = new Set(
    (task.labels ?? []).map((label) => normalizeLabel(label.name)),
  );
  return wanted.every((name) => names.has(normalizeLabel(name)));
}

export type ClientFilters = {
  readonly labels: ReadonlyArray<string>;
  readonly open: boolean;
};

export function needsClientFilter(filters: ClientFilters): boolean {
  return filters.labels.length > 0 || filters.open;
}

export function filterTasks(
  tasks: ReadonlyArray<BoardTask>,
  columns: ReadonlyArray<BoardColumnSummary>,
  filters: ClientFilters,
): BoardTask[] {
  const finalSlugs = new Set(
    columns.filter((column) => column.isFinal).map((column) => column.slug),
  );
  return tasks.filter(
    (task) =>
      hasLabels(task, filters.labels) &&
      !(filters.open && finalSlugs.has(task.status)),
  );
}

const PRIORITY_RANK: Readonly<Record<string, number>> = {
  urgent: 4,
  high: 3,
  medium: 2,
  low: 1,
};

function sortKey(
  task: BoardTask,
  field: TaskSortField,
): number | string | null {
  switch (field) {
    case "priority":
      return PRIORITY_RANK[task.priority] ?? 0;
    case "dueDate":
      return task.dueDate ? new Date(task.dueDate).getTime() : null;
    case "createdAt":
      return new Date(task.createdAt).getTime();
    case "title":
      return task.title.toLowerCase();
    case "number":
      return task.number;
    case "position":
      return task.position ?? null;
  }
}

function compareKeys(
  a: number | string | null,
  b: number | string | null,
  order: SortOrder,
): number {
  if (a === b) return 0;
  if (a === null) return order === "asc" ? 1 : -1;
  if (b === null) return order === "asc" ? -1 : 1;
  const base = a < b ? -1 : 1;
  return order === "asc" ? base : -base;
}

export function sortTasks(
  tasks: ReadonlyArray<BoardTask>,
  sort: TaskSort,
): BoardTask[] {
  return [...tasks].sort(
    (a, b) =>
      compareKeys(
        sortKey(a, sort.sortBy),
        sortKey(b, sort.sortBy),
        sort.sortOrder,
      ) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  );
}
