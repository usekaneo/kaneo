import { produce } from "immer";
import type { ProjectWithTasks } from "@/types/project";

export function applyBoardReorder(
  project: ProjectWithTasks,
  tasks: Array<{ id: string; position: number | null; status?: string }>,
): ProjectWithTasks {
  const changes = new Map(tasks.map((task) => [task.id, task]));
  return produce(project, (draft) => {
    const buckets = [
      ...draft.columns.map((column) => ({
        slug: column.slug,
        columnId: column.id,
        tasks: column.tasks,
      })),
      { slug: "planned", columnId: null, tasks: draft.plannedTasks },
      { slug: "archived", columnId: null, tasks: draft.archivedTasks },
    ];
    const moved: Array<{
      task: (typeof draft.columns)[number]["tasks"][number];
      slug: string;
    }> = [];
    for (const bucket of buckets) {
      for (let index = bucket.tasks.length - 1; index >= 0; index--) {
        const task = bucket.tasks[index];
        const change = changes.get(task.id);
        if (!change) continue;
        task.position = change.position;
        const destination =
          change.status &&
          buckets.find((bucket) => bucket.slug === change.status);
        if (destination && destination !== bucket) {
          task.status = destination.slug;
          task.columnId = destination.columnId;
          bucket.tasks.splice(index, 1);
          moved.push({ task, slug: destination.slug });
        }
      }
    }
    for (const { task, slug } of moved)
      buckets.find((bucket) => bucket.slug === slug)?.tasks.push(task);
    for (const bucket of buckets)
      bucket.tasks.sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
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
