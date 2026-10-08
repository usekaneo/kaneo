import { produce } from "immer";
import type { ProjectWithTasks } from "@/types/project";

export function moveBoardTask(
  project: ProjectWithTasks,
  activeId: string,
  overId: string,
  appendOnly = false,
  insertAfterTarget?: boolean,
) {
  const source = project.columns.find((column) =>
    column.tasks.some((task) => task.id === activeId),
  );
  const destination = project.columns.find(
    (column) =>
      column.id === overId || column.tasks.some((task) => task.id === overId),
  );
  if (
    !source ||
    !destination ||
    activeId === overId ||
    (appendOnly && source.id === destination.id)
  )
    return null;
  const next = produce(project, (draft) => {
    const from = draft.columns.find((column) => column.id === source.id)!;
    const to = draft.columns.find((column) => column.id === destination.id)!;
    const sourceIndex = from.tasks.findIndex((task) => task.id === activeId);
    const [task] = from.tasks.splice(sourceIndex, 1);
    task.status = to.slug;
    if (appendOnly) {
      task.position =
        Math.max(-1, ...to.tasks.map((task) => task.position ?? -1)) + 1;
      to.tasks.push(task);
      return;
    }
    let index =
      overId === to.id
        ? to.tasks.length
        : to.tasks.findIndex((task) => task.id === overId);
    if (overId !== to.id) {
      if (insertAfterTarget !== undefined) {
        index += insertAfterTarget ? 1 : 0;
      } else if (from.id !== to.id || sourceIndex <= index) {
        index += 1;
      }
    }
    to.tasks.splice(index, 0, task);
    for (const column of new Set([from, to]))
      column.tasks.forEach((task, position) => {
        task.position = position;
      });
  });
  const previous = new Map(
    project.columns
      .flatMap((column) => column.tasks)
      .map((task) => [task.id, task]),
  );
  const tasks = next.columns
    .flatMap((column) => column.tasks)
    .filter((task) => {
      const old = previous.get(task.id);
      return old?.position !== task.position || old.status !== task.status;
    })
    .map((task) => ({
      id: task.id,
      position: task.position ?? 0,
      ...(previous.get(task.id)?.status !== task.status
        ? { status: task.status }
        : {}),
    }));
  const expectedTasks = project.columns
    .filter((column) => column.id === source.id || column.id === destination.id)
    .flatMap((column) =>
      column.tasks.map((task) => ({
        id: task.id,
        position: task.position ?? null,
        status: task.status,
      })),
    );
  return { project: next, tasks, expectedTasks };
}
