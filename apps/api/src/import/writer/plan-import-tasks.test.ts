import type { ImportedTask } from "@kaneo/importers";
import { describe, expect, it } from "vite-plus/test";
import { parseImportDate, planImportTasks } from "./plan-import-tasks";

const now = new Date("2026-10-11T12:00:00.000Z");

function task(
  key: string,
  overrides: Partial<ImportedTask> = {},
): ImportedTask {
  return {
    key,
    columnKey: "todo",
    title: `Task ${key}`,
    description: "",
    priority: "medium",
    labelKeys: [],
    comments: [],
    ...overrides,
  };
}

function plan(tasks: ImportedTask[], numbers = tasks.map((_, i) => 41 + i)) {
  let id = 0;
  return planImportTasks({
    tasks,
    columns: new Map([
      ["todo", { id: "col-todo", slug: "to-do" }],
      ["done", { id: "col-done", slug: "done" }],
    ]),
    fallbackColumn: { id: "col-todo", slug: "to-do" },
    numbers,
    now,
    newId: () => `task-${++id}`,
    assign: (person) => (person?.email === "ana@example.com" ? "u-ana" : null),
  });
}

describe("planImportTasks", () => {
  it("numbers tasks as given and positions them per column or status", () => {
    const planned = plan([
      task("a"),
      task("b", { columnKey: "done" }),
      task("c"),
      task("d", { columnKey: null }),
      task("e", { archived: true, columnKey: "done" }),
      task("f", { columnKey: null }),
    ]);

    expect(
      planned.map(({ key, number, status, columnId, position }) => ({
        key,
        number,
        status,
        columnId,
        position,
      })),
    ).toEqual([
      {
        key: "a",
        number: 41,
        status: "to-do",
        columnId: "col-todo",
        position: 1,
      },
      {
        key: "b",
        number: 42,
        status: "done",
        columnId: "col-done",
        position: 1,
      },
      {
        key: "c",
        number: 43,
        status: "to-do",
        columnId: "col-todo",
        position: 2,
      },
      { key: "d", number: 44, status: "planned", columnId: null, position: 1 },
      { key: "e", number: 45, status: "archived", columnId: null, position: 1 },
      { key: "f", number: 46, status: "planned", columnId: null, position: 2 },
    ]);
  });

  it("keeps the given numbers apart from board order", () => {
    const planned = plan(
      [task("a"), task("b"), task("c", { columnKey: "done" })],
      [7, 3, 12],
    );

    expect(
      planned.map(({ key, number, position }) => ({ key, number, position })),
    ).toEqual([
      { key: "a", number: 7, position: 1 },
      { key: "b", number: 3, position: 2 },
      { key: "c", number: 12, position: 1 },
    ]);
  });

  it("refuses to plan a task without a number", () => {
    expect(() => plan([task("a"), task("b")], [1])).toThrow(
      "Every imported task needs a number",
    );
  });

  it("puts tasks from an unknown column in the fallback column", () => {
    expect(plan([task("a", { columnKey: "gone" })])[0]).toMatchObject({
      status: "to-do",
      columnId: "col-todo",
    });
  });

  it("cleans titles, priorities and dates", () => {
    const [planned] = plan([
      task("a", {
        title: "   ",
        priority: "critical" as ImportedTask["priority"],
        startDate: "not a date",
        dueDate: "2026-11-01",
        createdAt: "2021-03-04T05:06:07.000Z",
        assignee: { email: "ana@example.com" },
      }),
    ]);

    expect(planned).toMatchObject({
      id: "task-1",
      title: "Untitled task",
      priority: "no-priority",
      startDate: null,
      dueDate: new Date("2026-11-01T00:00:00.000Z"),
      createdAt: new Date("2021-03-04T05:06:07.000Z"),
      userId: "u-ana",
    });
  });

  it("dates tasks without a source date now", () => {
    expect(plan([task("a")])[0]?.createdAt).toEqual(now);
  });
});

describe("parseImportDate", () => {
  it("rejects dates Postgres cannot store", () => {
    expect(parseImportDate("-010000-01-01T00:00:00Z")).toBeNull();
    expect(parseImportDate(undefined)).toBeNull();
    expect(parseImportDate("2024-02-29")).toEqual(
      new Date("2024-02-29T00:00:00.000Z"),
    );
  });
});
