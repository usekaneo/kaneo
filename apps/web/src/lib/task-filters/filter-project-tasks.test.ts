import { expect, it } from "vite-plus/test";
import type { ProjectWithTasks } from "@/types/project";
import type Task from "@/types/task";
import { filterProjectTasks } from "./filter-project-tasks";

const task = (id: string) => ({ id }) as Task;

it("filters board columns, planned and archived tasks alike", () => {
  const project = {
    id: "p",
    columns: [{ id: "todo", tasks: [task("a"), task("b")] }],
    plannedTasks: [task("c"), task("d")],
    archivedTasks: [task("e")],
  } as unknown as ProjectWithTasks;

  const filtered = filterProjectTasks(project, (item) =>
    ["a", "d"].includes(item.id),
  );

  expect(filtered.columns[0].tasks.map((item) => item.id)).toEqual(["a"]);
  expect(filtered.plannedTasks.map((item) => item.id)).toEqual(["d"]);
  expect(filtered.archivedTasks).toEqual([]);
  expect(project.columns[0].tasks).toHaveLength(2);
});
