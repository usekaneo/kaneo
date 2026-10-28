import type { KaneoBoard, KaneoBoardColumn, KaneoBoardTask } from "./client.js";

export type MergedBoard = {
  columns: KaneoBoardColumn[];
  tasks: KaneoBoardTask[];
};

export const PLANNED_STATUS = "planned";
export const ARCHIVED_STATUS = "archived";

export function columnSlug(column: KaneoBoardColumn): string {
  return column.slug ?? column.id;
}

export function boardTasks(board: KaneoBoard): KaneoBoardTask[] {
  return [
    ...board.columns.flatMap((column) => column.tasks ?? []),
    ...(board.plannedTasks ?? []),
    ...(board.archivedTasks ?? []),
  ];
}

export function mergeBoardPages(pages: KaneoBoard[]): MergedBoard {
  const columns = new Map<string, KaneoBoardColumn>();
  const tasks = new Map<string, KaneoBoardTask>();

  for (const page of pages) {
    for (const column of page.columns) {
      const slug = columnSlug(column);
      if (!columns.has(slug)) columns.set(slug, { ...column, tasks: [] });
    }
    for (const task of boardTasks(page)) {
      const existing = tasks.get(task.id);
      if (!existing) {
        tasks.set(task.id, {
          ...task,
          labels: uniqueBy(task.labels ?? [], labelIdentity),
          externalLinks: uniqueBy(task.externalLinks ?? [], (link) => link.id),
        });
        continue;
      }
      existing.labels = uniqueBy(
        [...(existing.labels ?? []), ...(task.labels ?? [])],
        labelIdentity,
      );
      existing.externalLinks = uniqueBy(
        [...(existing.externalLinks ?? []), ...(task.externalLinks ?? [])],
        (link) => link.id,
      );
    }
  }

  return {
    columns: stableSortBy([...columns.values()], (column) => [
      column.position ?? Number.POSITIVE_INFINITY,
    ]),
    tasks: [...tasks.values()],
  };
}

export function orderTasks(
  columns: KaneoBoardColumn[],
  tasks: KaneoBoardTask[],
): KaneoBoardTask[] {
  const byStatus = new Map<string, KaneoBoardTask[]>();
  for (const task of tasks) {
    const bucket = byStatus.get(task.status) ?? [];
    bucket.push(task);
    byStatus.set(task.status, bucket);
  }

  const statuses = [
    ...columns.map(columnSlug),
    PLANNED_STATUS,
    ...[...byStatus.keys()].filter(
      (status) =>
        status !== PLANNED_STATUS &&
        status !== ARCHIVED_STATUS &&
        !columns.some((column) => columnSlug(column) === status),
    ),
    ARCHIVED_STATUS,
  ];

  return [...new Set(statuses)].flatMap((status) =>
    stableSortBy(byStatus.get(status) ?? [], (task) => [
      task.position ?? Number.POSITIVE_INFINITY,
      task.number ?? Number.POSITIVE_INFINITY,
    ]),
  );
}

function labelIdentity(label: { id?: string; name: string }): string {
  return label.id ?? `name:${label.name}`;
}

function uniqueBy<T>(items: T[], identity: (item: T) => string): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = identity(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function stableSortBy<T>(items: T[], keys: (item: T) => number[]): T[] {
  return items
    .map((item, index) => ({ item, index, keys: keys(item) }))
    .sort((a, b) => {
      for (let i = 0; i < a.keys.length; i++) {
        const diff = compareNumbers(a.keys[i], b.keys[i]);
        if (diff !== 0) return diff;
      }
      return a.index - b.index;
    })
    .map(({ item }) => item);
}

function compareNumbers(a: number | undefined, b: number | undefined): number {
  const left = a ?? Number.POSITIVE_INFINITY;
  const right = b ?? Number.POSITIVE_INFINITY;
  if (left === right) return 0;
  return left < right ? -1 : 1;
}
