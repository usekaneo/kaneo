import { Effect } from "effect";
import { getBoardPage } from "../api/endpoints.js";
import type { Query } from "../api/kaneo-api.js";
import type { BoardLabel, BoardPage, BoardTask } from "../api/schemas.js";
import { BACKLOG_STATUS, backlogColumn } from "./backlog.js";

export type TaskSortField =
  | "createdAt"
  | "priority"
  | "dueDate"
  | "position"
  | "title"
  | "number";

export type TaskFilters = {
  readonly status?: string | undefined;
  readonly priority?: string | undefined;
  readonly assigneeId?: string | undefined;
  readonly sortBy?: TaskSortField | undefined;
  readonly sortOrder?: "asc" | "desc" | undefined;
  readonly dueBefore?: string | undefined;
  readonly dueAfter?: string | undefined;
};

export type BoardColumnSummary = {
  readonly slug: string;
  readonly name: string;
  readonly isFinal: boolean;
};

export type LoadedBoard = {
  readonly projectId: string;
  readonly workspaceId: string;
  readonly projectSlug: string;
  readonly projectName: string;
  readonly columns: ReadonlyArray<BoardColumnSummary>;
  readonly tasks: ReadonlyArray<BoardTask>;
  readonly total: number;
};

const PAGE_SIZE = 100;

const pageTasks = (data: BoardPage["data"]): BoardTask[] => [
  ...data.columns.flatMap((column) => column.tasks),
  // Older projects can have a real planned column. The API already includes
  // its tasks above when that column is on the current metadata page.
  ...(data.columns.some((column) => column.slug === BACKLOG_STATUS)
    ? []
    : (data.plannedTasks ?? [])),
];

const loadExtraLabels = Effect.fnUntraced(function* (
  projectId: string,
  query: Query,
  relatedTotalPages: number,
) {
  const labels = new Map<string, BoardLabel[]>();
  for (let relatedPage = 2; relatedPage <= relatedTotalPages; relatedPage++) {
    const response = yield* getBoardPage(projectId, { ...query, relatedPage });
    for (const task of pageTasks(response.data)) {
      if (!task.labels || task.labels.length === 0) continue;
      labels.set(task.id, [...(labels.get(task.id) ?? []), ...task.labels]);
    }
  }
  return labels;
});

export const loadBoard = Effect.fn("tasks.loadBoard")(function* (
  projectId: string,
  filters: TaskFilters,
  limit: number,
) {
  let columns = new Map<string, BoardColumnSummary>();
  const tasks: BoardTask[] = [];
  let page = 1;
  let totalPages = 1;
  let total = 0;
  let meta = { workspaceId: "", slug: "", name: "" };

  while (page <= totalPages && tasks.length < limit) {
    const query: Query = {
      page,
      limit: Math.min(PAGE_SIZE, limit),
      status: filters.status,
      priority: filters.priority,
      assigneeId: filters.assigneeId,
      sortBy: filters.sortBy,
      sortOrder: filters.sortOrder,
      dueBefore: filters.dueBefore,
      dueAfter: filters.dueAfter,
    };
    const response = yield* getBoardPage(projectId, query);
    meta = {
      workspaceId: response.data.workspaceId,
      slug: response.data.slug,
      name: response.data.name,
    };
    const relatedTotalPages = response.pagination.relatedTotalPages ?? 1;
    const extraLabels =
      relatedTotalPages > 1
        ? yield* loadExtraLabels(projectId, query, relatedTotalPages)
        : new Map<string, BoardLabel[]>();
    for (const column of response.data.columns) {
      if (!columns.has(column.slug)) {
        columns.set(column.slug, {
          slug: column.slug,
          name: column.name,
          isFinal: column.isFinal,
        });
      }
    }
    if (response.data.plannedTasks?.length && !columns.has(BACKLOG_STATUS)) {
      const { slug, name, isFinal } = backlogColumn(projectId);
      columns = new Map([[slug, { slug, name, isFinal }], ...columns]);
    }
    for (const task of pageTasks(response.data)) {
      const extra = extraLabels.get(task.id);
      tasks.push(
        extra ? { ...task, labels: [...(task.labels ?? []), ...extra] } : task,
      );
    }
    total = response.pagination.total;
    totalPages = response.pagination.totalPages;
    page += 1;
  }

  return {
    projectId,
    workspaceId: meta.workspaceId,
    projectSlug: meta.slug,
    projectName: meta.name,
    columns: [...columns.values()],
    tasks: tasks.slice(0, limit),
    total,
  } satisfies LoadedBoard;
});
