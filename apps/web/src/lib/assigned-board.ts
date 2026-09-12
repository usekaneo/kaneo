import type { AssignedTaskProject, AssignedTasksData } from "@/types/my-tasks";
import type { ProjectWithTasks } from "@/types/project";

/** Id of the synthetic board; never a real project id, never sent to the API. */
export const MY_TASKS_BOARD_ID = "my-tasks";

export type AssignedBoard = {
  board: ProjectWithTasks;
  projectById: Map<string, AssignedTaskProject>;
  projectIdByTaskId: Map<string, string>;
};

type MergedColumn = ProjectWithTasks["columns"][number] & {
  minPosition: number;
};

/**
 * Folds the tasks of many projects into one board shaped like a project's.
 *
 * Columns are merged by slug: projects created from the defaults share
 * `to-do`/`in-progress`/`in-review`/`done`, so those line up, and any custom
 * column shows up as its own column. A task's `status` already is a slug, so
 * bucketing needs no mapping. Tasks whose project or column is unknown are
 * dropped, as the project board does.
 */
export function buildAssignedBoard(
  data: Pick<AssignedTasksData, "tasks" | "projects">,
): AssignedBoard {
  const projectById = new Map<string, AssignedTaskProject>();
  const columnsBySlug = new Map<string, MergedColumn>();

  for (const project of data.projects) {
    projectById.set(project.id, project);
    for (const column of project.columns) {
      const merged = columnsBySlug.get(column.slug);
      if (!merged) {
        columnsBySlug.set(column.slug, {
          id: column.slug,
          slug: column.slug,
          name: column.name,
          icon: column.icon,
          isFinal: column.isFinal,
          tasks: [],
          minPosition: column.position,
        });
        continue;
      }
      merged.isFinal = merged.isFinal || column.isFinal;
      merged.icon = merged.icon ?? column.icon;
      merged.minPosition = Math.min(merged.minPosition, column.position);
    }
  }

  const projectIdByTaskId = new Map<string, string>();
  for (const task of data.tasks) {
    const column = columnsBySlug.get(task.status);
    if (!column || !projectById.has(task.projectId)) continue;
    column.tasks.push(task);
    projectIdByTaskId.set(task.id, task.projectId);
  }

  const columns = [...columnsBySlug.values()]
    .sort(
      (left, right) =>
        left.minPosition - right.minPosition ||
        left.slug.localeCompare(right.slug),
    )
    .map(({ minPosition: _position, ...column }) => column);

  return {
    board: {
      id: MY_TASKS_BOARD_ID,
      name: "",
      slug: "",
      icon: null,
      description: null,
      isPublic: false,
      workspaceId: "",
      columns,
      archivedTasks: [],
      plannedTasks: [],
    },
    projectById,
    projectIdByTaskId,
  };
}
