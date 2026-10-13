import { expect, it } from "vite-plus/test";
import type { ProjectWithTasks } from "@/types/project";
import { selectReorderBoard } from "./select-reorder-board";

it("includes a newly created local card without replacing newer cached metadata", () => {
  const cached = {
    id: "p",
    columns: [
      {
        slug: "todo",
        tasks: [{ id: "old", status: "todo", title: "new remote title" }],
      },
    ],
  } as unknown as ProjectWithTasks;
  const stored = {
    id: "p",
    columns: [
      {
        slug: "todo",
        tasks: [
          { id: "old", status: "todo", title: "stale title" },
          { id: "created", status: "todo", position: 1 },
        ],
      },
    ],
  } as unknown as ProjectWithTasks;
  expect(
    selectReorderBoard("p", "created", cached, stored)?.columns[0].tasks,
  ).toEqual([cached.columns[0].tasks[0], stored.columns[0].tasks[1]]);
  expect(
    selectReorderBoard("p", "old", cached, stored)?.columns[0].tasks,
  ).toEqual([cached.columns[0].tasks[0], stored.columns[0].tasks[1]]);
  expect(
    selectReorderBoard("p", "created", cached, { ...stored, id: "other" }),
  ).toBe(cached);
});
