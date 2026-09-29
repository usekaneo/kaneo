import { produce } from "immer";
import type { ProjectWithTasks } from "@/types/project";

export function applyBoardReorder(
  project: ProjectWithTasks,
  tasks: Array<{ id: string; position: number; status?: string }>,
): ProjectWithTasks {
  const changes = new Map(tasks.map((task) => [task.id, task]));
  return produce(project, (draft) => {
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
