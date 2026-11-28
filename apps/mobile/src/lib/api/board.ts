import { api } from "./endpoints";
import type { BoardColumn, BoardData, BoardTask, TaskLabel } from "./types";

function mergeLabels(a: TaskLabel[] = [], b: TaskLabel[] = []): TaskLabel[] {
  const byId = new Map<string, TaskLabel>();
  [...a, ...b].forEach((l) => byId.set(l.id, l));
  return [...byId.values()];
}

function appendTo(target: Map<string, BoardTask>, tasks: BoardTask[] = []) {
  for (const task of tasks) {
    const prior = target.get(task.id);
    target.set(
      task.id,
      prior
        ? { ...prior, labels: mergeLabels(prior.labels, task.labels) }
        : task,
    );
  }
}

/**
 * Loads every page of a board. The API pages tasks (100 at most) and, per task page, pages the
 * related labels separately; both are followed to completion and merged by id.
 */
export async function loadFullBoard(projectId: string): Promise<BoardData> {
  const first = await api.board(projectId, 1);
  const columns = new Map<
    string,
    { metadata: Omit<BoardColumn, "tasks">; tasks: Map<string, BoardTask> }
  >();
  const archived = new Map<string, BoardTask>();
  const planned = new Map<string, BoardTask>();

  const merge = (data: BoardData) => {
    for (const column of data.columns ?? []) {
      let loadedColumn = columns.get(column.id);
      if (!loadedColumn) {
        const { tasks: _tasks, ...metadata } = column;
        loadedColumn = { metadata, tasks: new Map() };
        columns.set(column.id, loadedColumn);
      }
      appendTo(loadedColumn.tasks, column.tasks);
    }
    appendTo(archived, data.archivedTasks);
    appendTo(planned, data.plannedTasks);
  };

  const loadRelated = async (page: number, relatedTotal = 1) => {
    for (let related = 2; related <= relatedTotal; related++)
      merge((await api.board(projectId, page, related)).data);
  };

  merge(first.data);
  await loadRelated(1, first.pagination?.relatedTotalPages);
  for (let page = 2; page <= (first.pagination?.totalPages ?? 1); page++) {
    const next = await api.board(projectId, page);
    merge(next.data);
    await loadRelated(page, next.pagination?.relatedTotalPages);
  }

  const byPosition = (a: BoardTask, b: BoardTask) =>
    (a.position ?? Number.MAX_VALUE) - (b.position ?? Number.MAX_VALUE);
  return {
    ...first.data,
    columns: [...columns.values()]
      .map(({ metadata, tasks }) => ({
        ...metadata,
        tasks: [...tasks.values()].sort(byPosition),
      }))
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0)),
    archivedTasks: [...archived.values()],
    plannedTasks: [...planned.values()],
  };
}
