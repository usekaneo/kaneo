import { expect, it } from "vite-plus/test";
import type { ProjectWithTasks } from "@/types/project";
import { countBacklogTasks, countColumnTasks } from "./count-tasks";

const project = {
  columns: [{ tasks: [{}, {}] }, { tasks: [{}] }],
  plannedTasks: [{}],
  archivedTasks: [{}, {}],
} as unknown as ProjectWithTasks;

it("counts board tasks and backlog tasks separately", () => {
  expect(countColumnTasks(project)).toBe(3);
  expect(countBacklogTasks(project)).toBe(3);
  expect(countColumnTasks(null)).toBe(0);
});
