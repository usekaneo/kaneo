import type {
  ImportedComment,
  ImportedPerson,
  ImportedTask,
} from "@kaneo/importers";
import { VALID_PRIORITIES } from "../../task/validate-task-fields";

export type BoardColumn = { id: string; slug: string };

export type PlannedImportTask = {
  id: string;
  key: string;
  number: number;
  title: string;
  description: string;
  status: string;
  columnId: string | null;
  position: number;
  priority: string;
  startDate: Date | null;
  dueDate: Date | null;
  createdAt: Date;
  userId: string | null;
  labelKeys: readonly string[];
  comments: readonly ImportedComment[];
};

type PlanImportTasksInput = {
  tasks: readonly ImportedTask[];
  columns: ReadonlyMap<string, BoardColumn>;
  fallbackColumn: BoardColumn | null;
  numbers: readonly number[];
  now: Date;
  newId: () => string;
  assign: (person: ImportedPerson | undefined) => string | null;
};

const UNTITLED_TASK = "Untitled task";
const MIN_YEAR = 1;
const MAX_YEAR = 9999;

export function parseImportDate(value: string | undefined): Date | null {
  if (!value) return null;
  const time = Date.parse(value);
  if (Number.isNaN(time)) return null;
  const date = new Date(time);
  const year = date.getUTCFullYear();
  return year >= MIN_YEAR && year <= MAX_YEAR ? date : null;
}

export function importPriority(priority: string): string {
  return (VALID_PRIORITIES as readonly string[]).includes(priority)
    ? priority
    : "no-priority";
}

function placeTask(
  task: ImportedTask,
  columns: ReadonlyMap<string, BoardColumn>,
  fallbackColumn: BoardColumn | null,
): { status: string; columnId: string | null } {
  if (task.archived) return { status: "archived", columnId: null };
  if (task.columnKey === null) return { status: "planned", columnId: null };
  const column = columns.get(task.columnKey) ?? fallbackColumn;
  return column
    ? { status: column.slug, columnId: column.id }
    : { status: "planned", columnId: null };
}

export function planImportTasks({
  tasks,
  columns,
  fallbackColumn,
  numbers,
  now,
  newId,
  assign,
}: PlanImportTasksInput): PlannedImportTask[] {
  const positions = new Map<string, number>();

  return tasks.map((task, index) => {
    const number = numbers[index];
    if (number === undefined) {
      throw new Error("Every imported task needs a number");
    }
    const placement = placeTask(task, columns, fallbackColumn);
    const bucket = placement.columnId ?? `status:${placement.status}`;
    const position = (positions.get(bucket) ?? 0) + 1;
    positions.set(bucket, position);

    return {
      id: newId(),
      key: task.key,
      number,
      title: task.title.trim() || UNTITLED_TASK,
      description: task.description ?? "",
      ...placement,
      position,
      priority: importPriority(task.priority),
      startDate: parseImportDate(task.startDate),
      dueDate: parseImportDate(task.dueDate),
      createdAt: parseImportDate(task.createdAt) ?? now,
      userId: assign(task.assignee),
      labelKeys: task.labelKeys,
      comments: task.comments,
    };
  });
}
