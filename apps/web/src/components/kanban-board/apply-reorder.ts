import { produce } from "immer";
import type { ProjectWithTasks } from "@/types/project";

export function applyBoardReorder(
  project: ProjectWithTasks,
  tasks: Array<{ id: string; position: number | null; status?: string }>,
): ProjectWithTasks {
  const changes = new Map(tasks.map((task) => [task.id, task]));
  return produce(project, (draft) => {
    for (const bucket of [draft.plannedTasks, draft.archivedTasks]) {
      for (const task of bucket) {
        const change = changes.get(task.id);
        if (change) task.position = change.position;
      }
      bucket.sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
    }
    const moved: Array<{
      task: (typeof draft.columns)[number]["tasks"][number];
      slug: string;
    }> = [];
    for (const column of draft.columns) {
      column.tasks = column.tasks.filter((task) => {
        const change = changes.get(task.id);
        if (!change) return true;
        task.position = change.position;
        if (change.status && change.status !== column.slug) {
          const destination = draft.columns.find(
            (column) => column.slug === change.status,
          );
          if (destination) {
            task.status = change.status;
            task.columnId = destination.id;
            moved.push({ task, slug: change.status });
            return false;
          }
        }
        return true;
      });
    }
    for (const { task, slug } of moved)
      draft.columns.find((column) => column.slug === slug)?.tasks.push(task);
    for (const column of draft.columns)
      column.tasks.sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  });
}

export function rollbackBoardReorder(
  current: ProjectWithTasks,
  previous: ProjectWithTasks,
  tasks: Array<{ id: string; position: number; status?: string }>,
) {
  const prior = new Map(
    previous.columns
      .flatMap((column) => column.tasks)
      .map((task) => [task.id, task]),
  );
  const cards = new Map(
    current.columns
      .flatMap((column) => column.tasks)
      .map((task) => [task.id, task]),
  );
  if (
    !tasks.every(
      (change) =>
        cards.get(change.id)?.position === change.position &&
        cards.get(change.id)?.status ===
          (change.status ?? prior.get(change.id)?.status),
    )
  )
    return null;
  return applyBoardReorder(
    current,
    tasks.flatMap((change) => {
      const task = prior.get(change.id);
      return task
        ? [
            {
              id: task.id,
              position: task.position ?? null,
              status: task.status,
            },
          ]
        : [];
    }),
  );
}
