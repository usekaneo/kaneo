import type { ImportedColumn } from "../types.js";
import type {
  JiraBoardColumn,
  JiraIssue,
  JiraIssueTypeStatuses,
  JiraStatus,
} from "./api-types.js";

export type ColumnPlan = {
  columns: ImportedColumn[];
  columnKeyByStatus: ReadonlyMap<string, string | null>;
};

export type StatusCategories = ReadonlyMap<string, string>;

const DONE_CATEGORY = "done";
const CATEGORY_ORDER = ["new", "indeterminate", DONE_CATEGORY];
const UNKNOWN_CATEGORY_RANK = CATEGORY_ORDER.indexOf("indeterminate");

export function isBacklogName(name: string): boolean {
  return name.trim().toLowerCase() === "backlog";
}

export function collectStatuses(
  groups: JiraIssueTypeStatuses[],
  issues: JiraIssue[],
): JiraStatus[] {
  const byId = new Map<string, JiraStatus>();
  const candidates = [
    ...groups.flatMap((group) => group.statuses ?? []),
    ...issues.flatMap((issue) =>
      issue.fields?.status ? [issue.fields.status] : [],
    ),
  ];
  for (const status of candidates) {
    if (status?.id && !byId.has(status.id)) byId.set(status.id, status);
  }
  return [...byId.values()];
}

export function statusCategories(statuses: JiraStatus[]): StatusCategories {
  const categories = new Map<string, string>();
  for (const status of statuses) {
    const key = status.statusCategory?.key?.trim().toLowerCase();
    if (key) categories.set(status.id, key);
  }
  return categories;
}

export function planBoardColumns(
  boardColumns: JiraBoardColumn[],
  categories: StatusCategories,
): ColumnPlan {
  const columnKeyByStatus = new Map<string, string | null>();
  const kept: Array<{ key: string; name: string; statusIds: string[] }> = [];

  for (const [index, column] of boardColumns.entries()) {
    const statusIds = (column.statuses ?? [])
      .map((status) => status?.id)
      .filter((id): id is string => Boolean(id));
    if (statusIds.length === 0) continue;

    const name = column.name?.trim() || "Untitled";
    const key = isBacklogName(name) ? null : `column-${index + 1}`;
    for (const id of statusIds) {
      if (!columnKeyByStatus.has(id)) columnKeyByStatus.set(id, key);
    }
    if (key) kept.push({ key, name, statusIds });
  }

  const columns = kept.map((column, index) => ({
    key: column.key,
    name: column.name,
    isFinal:
      index === kept.length - 1 ||
      column.statusIds.every((id) => categories.get(id) === DONE_CATEGORY),
  }));
  return { columns, columnKeyByStatus };
}

export function planStatusColumns(statuses: JiraStatus[]): ColumnPlan {
  const columnKeyByStatus = new Map<string, string | null>();
  const columns: ImportedColumn[] = [];

  const ordered = statuses
    .map((status, index) => ({ status, index }))
    .sort(
      (a, b) =>
        categoryRank(a.status) - categoryRank(b.status) || a.index - b.index,
    );

  for (const { status } of ordered) {
    const name = status.name?.trim() || "Untitled";
    if (isBacklogName(name)) {
      columnKeyByStatus.set(status.id, null);
      continue;
    }
    columnKeyByStatus.set(status.id, status.id);
    columns.push({
      key: status.id,
      name,
      isFinal: categoryOf(status) === DONE_CATEGORY,
    });
  }

  return { columns, columnKeyByStatus };
}

export function resolveColumnKey(
  plan: ColumnPlan,
  statusId: string | undefined,
  categories: StatusCategories,
): string | null {
  if (!statusId) return null;
  const mapped = plan.columnKeyByStatus.get(statusId);
  if (mapped !== undefined) return mapped;
  if (categories.get(statusId) !== DONE_CATEGORY) return null;
  return plan.columns.filter((column) => column.isFinal).at(-1)?.key ?? null;
}

function categoryOf(status: JiraStatus): string | undefined {
  return status.statusCategory?.key?.trim().toLowerCase();
}

function categoryRank(status: JiraStatus): number {
  const index = CATEGORY_ORDER.indexOf(categoryOf(status) ?? "");
  return index === -1 ? UNKNOWN_CATEGORY_RANK : index;
}
