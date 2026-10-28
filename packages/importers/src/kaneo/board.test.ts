import { describe, expect, it } from "vite-plus/test";
import { mergeBoardPages, orderTasks } from "./board.js";
import type { KaneoBoard, KaneoBoardColumn, KaneoBoardTask } from "./client.js";

function task(
  id: string,
  status: string,
  overrides: Partial<KaneoBoardTask> = {},
): KaneoBoardTask {
  return {
    id,
    title: id,
    number: null,
    description: null,
    status,
    priority: "no-priority",
    position: null,
    userId: null,
    labels: [],
    externalLinks: [],
    ...overrides,
  };
}

function column(
  slug: string,
  position: number,
  tasks: KaneoBoardTask[] = [],
): KaneoBoardColumn {
  return { id: slug, slug, name: slug, isFinal: false, position, tasks };
}

function board(overrides: Partial<KaneoBoard>): KaneoBoard {
  return {
    id: "p1",
    name: "Project",
    description: null,
    workspaceId: "ws1",
    columns: [],
    plannedTasks: [],
    archivedTasks: [],
    ...overrides,
  };
}

describe("mergeBoardPages", () => {
  it("dedupes tasks across related pages and merges their labels", () => {
    const red = { id: "l1", name: "Bug", color: "red" };
    const blue = { id: "l2", name: "UI", color: "purple" };
    const merged = mergeBoardPages([
      board({
        columns: [column("to-do", 0, [task("t1", "to-do", { labels: [red] })])],
      }),
      board({
        columns: [
          column("to-do", 0, [task("t1", "to-do", { labels: [red, blue] })]),
        ],
      }),
    ]);

    expect(merged.tasks).toHaveLength(1);
    expect(merged.tasks[0]?.labels).toEqual([red, blue]);
  });

  it("collects planned and archived tasks and orders columns by position", () => {
    const merged = mergeBoardPages([
      board({
        columns: [column("done", 2), column("to-do", 0)],
        plannedTasks: [task("t2", "planned")],
      }),
      board({
        columns: [column("in-progress", 1)],
        archivedTasks: [task("t3", "archived")],
      }),
    ]);

    expect(merged.columns.map((c) => c.slug)).toEqual([
      "to-do",
      "in-progress",
      "done",
    ]);
    expect(merged.tasks.map((t) => t.id)).toEqual(["t2", "t3"]);
  });
});

describe("orderTasks", () => {
  it("orders by column, then position, then number, with planned and archived last", () => {
    const columns = [column("to-do", 0), column("done", 1)];
    const ordered = orderTasks(columns, [
      task("archived", "archived", { position: 0 }),
      task("done-1", "done", { position: 0 }),
      task("todo-b", "to-do", { position: 2 }),
      task("planned", "planned", { position: 0 }),
      task("todo-a", "to-do", { position: 1 }),
      task("todo-c", "to-do", { position: 2, number: 1 }),
    ]);

    expect(ordered.map((t) => t.id)).toEqual([
      "todo-a",
      "todo-c",
      "todo-b",
      "done-1",
      "planned",
      "archived",
    ]);
  });
});
