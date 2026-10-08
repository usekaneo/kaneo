import { Result } from "effect";
import { describe, expect, it } from "vite-plus/test";
import type { BoardTask } from "../api/schemas.js";
import {
  checkDueWindow,
  dueBound,
  filterTasks,
  hasLabels,
  needsClientFilter,
  sortTasks,
  toTaskSort,
} from "./list-query.js";

function task(overrides: Partial<BoardTask> & { readonly id: string }) {
  return {
    title: overrides.id,
    number: 1,
    status: "to-do",
    priority: "no-priority",
    startDate: null,
    dueDate: null,
    createdAt: "2026-10-01T10:00:00.000Z",
    assigneeId: null,
    assigneeName: null,
    projectId: "p1",
    ...overrides,
  } satisfies BoardTask;
}

const columns = [
  { slug: "to-do", name: "To Do", isFinal: false },
  { slug: "done", name: "Done", isFinal: true },
];

describe("toTaskSort", () => {
  it("maps the flag names to the API sort fields", () => {
    expect(Result.getOrThrow(toTaskSort("due", undefined))).toEqual({
      sortBy: "dueDate",
      sortOrder: "asc",
    });
    expect(Result.getOrThrow(toTaskSort("created", "asc"))).toEqual({
      sortBy: "createdAt",
      sortOrder: "asc",
    });
    expect(Result.getOrThrow(toTaskSort("title", "desc"))).toEqual({
      sortBy: "title",
      sortOrder: "desc",
    });
  });

  it("puts urgent and newest first unless an order is given", () => {
    expect(Result.getOrThrow(toTaskSort("priority", undefined))).toEqual({
      sortBy: "priority",
      sortOrder: "desc",
    });
    expect(Result.getOrThrow(toTaskSort("created", undefined))?.sortOrder).toBe(
      "desc",
    );
  });

  it("keeps the server order without --sort", () => {
    expect(Result.getOrThrow(toTaskSort(undefined, undefined))).toBeUndefined();
  });

  it("refuses --order without --sort", () => {
    const result = toTaskSort(undefined, "desc");
    expect(Result.isFailure(result)).toBe(true);
  });
});

describe("dueBound", () => {
  const now = new Date(2026, 9, 8, 15, 0, 0);

  it("covers the whole day for --due-before", () => {
    const bound = new Date(
      Result.getOrThrow(dueBound("2026-10-10", now, "before")),
    );
    expect([bound.getDate(), bound.getHours(), bound.getMinutes()]).toEqual([
      10, 23, 59,
    ]);
  });

  it("starts at midnight for --due-after", () => {
    const bound = new Date(
      Result.getOrThrow(dueBound("tomorrow", now, "after")),
    );
    expect([bound.getDate(), bound.getHours(), bound.getMinutes()]).toEqual([
      9, 0, 0,
    ]);
  });

  it("names the flag when the date is invalid", () => {
    const result = dueBound("someday", now, "after");
    expect(Result.isFailure(result)).toBe(true);
    if (Result.isFailure(result)) {
      expect(result.failure.message).toBe(
        '--due-after "someday" is not a date.',
      );
    }
  });

  it("rejects a window that ends before it starts", () => {
    const after = Result.getOrThrow(dueBound("2026-10-12", now, "after"));
    const before = Result.getOrThrow(dueBound("2026-10-10", now, "before"));
    expect(Result.isFailure(checkDueWindow(after, before))).toBe(true);
    expect(Result.isSuccess(checkDueWindow(before, before))).toBe(true);
  });
});

describe("client filters", () => {
  const bug = { id: "l1", name: "Bug", color: "#f00" };
  const ui = { id: "l2", name: "UI", color: "#00f" };

  it("matches label names without regard to case and requires all of them", () => {
    expect(hasLabels(task({ id: "a", labels: [bug, ui] }), ["bug", "ui"])).toBe(
      true,
    );
    expect(hasLabels(task({ id: "a", labels: [bug] }), ["bug", "ui"])).toBe(
      false,
    );
    expect(hasLabels(task({ id: "a" }), [])).toBe(true);
    expect(hasLabels(task({ id: "a" }), ["bug"])).toBe(false);
  });

  it("hides tasks in final columns with --open", () => {
    const tasks = [
      task({ id: "a", status: "to-do", labels: [bug] }),
      task({ id: "b", status: "done", labels: [bug] }),
      task({ id: "c", status: "to-do" }),
    ];
    expect(
      filterTasks(tasks, columns, { labels: ["Bug"], open: true }).map(
        (item) => item.id,
      ),
    ).toEqual(["a"]);
    expect(
      filterTasks(tasks, columns, { labels: [], open: true }).map(
        (item) => item.id,
      ),
    ).toEqual(["a", "c"]);
  });

  it("only loads the whole board when a client filter is set", () => {
    expect(needsClientFilter({ labels: [], open: false })).toBe(false);
    expect(needsClientFilter({ labels: ["bug"], open: false })).toBe(true);
    expect(needsClientFilter({ labels: [], open: true })).toBe(true);
  });
});

describe("sortTasks", () => {
  it("orders by priority rank, not by name", () => {
    const tasks = [
      task({ id: "a", priority: "low" }),
      task({ id: "b", priority: "urgent" }),
      task({ id: "c", priority: "no-priority" }),
      task({ id: "d", priority: "high" }),
    ];
    expect(
      sortTasks(tasks, { sortBy: "priority", sortOrder: "desc" }).map(
        (item) => item.id,
      ),
    ).toEqual(["b", "d", "a", "c"]);
  });

  it("puts tasks without a due date last when ascending, like the API", () => {
    const tasks = [
      task({ id: "a" }),
      task({ id: "b", dueDate: "2026-10-12T12:00:00.000Z" }),
      task({ id: "c", dueDate: "2026-10-09T12:00:00.000Z" }),
    ];
    expect(
      sortTasks(tasks, { sortBy: "dueDate", sortOrder: "asc" }).map(
        (item) => item.id,
      ),
    ).toEqual(["c", "b", "a"]);
    expect(
      sortTasks(tasks, { sortBy: "dueDate", sortOrder: "desc" }).map(
        (item) => item.id,
      ),
    ).toEqual(["a", "b", "c"]);
  });

  it("breaks ties by id", () => {
    const tasks = [task({ id: "b", number: 2 }), task({ id: "a", number: 2 })];
    expect(
      sortTasks(tasks, { sortBy: "number", sortOrder: "desc" }).map(
        (item) => item.id,
      ),
    ).toEqual(["a", "b"]);
  });
});
