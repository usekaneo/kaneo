import type { ProjectWithTasks } from "@/types/project";

export function testBoard() {
  return {
    id: "project",
    columns: [
      {
        id: "todo",
        slug: "todo",
        tasks: [
          { id: "a", status: "todo", position: 0 },
          { id: "b", status: "todo", position: 1 },
        ],
      },
      {
        id: "doing",
        slug: "doing",
        tasks: [
          { id: "c", status: "doing", position: 0 },
          { id: "d", status: "doing", position: 1 },
        ],
      },
      { id: "done", slug: "done", tasks: [] },
    ],
    plannedTasks: [],
    archivedTasks: [],
  } as unknown as ProjectWithTasks;
}

export function columnIds(board: ProjectWithTasks | null) {
  return board?.columns.map((column) =>
    column.tasks.map((task) => task.id).join(","),
  );
}
