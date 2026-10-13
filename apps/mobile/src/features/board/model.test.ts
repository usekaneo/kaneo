import { describe, expect, it } from "vite-plus/test";
import type { BoardData, BoardTask } from "@/lib/api/types";
import { emptyFilters, filterCount, lanes, matches, UNASSIGNED } from "./model";

function task(overrides: Partial<BoardTask> = {}): BoardTask {
  return {
    id: "t1",
    title: "Fix login redirect",
    number: 42,
    status: "to-do",
    projectId: "p1",
    ...overrides,
  };
}

describe("matches", () => {
  it("finds tasks by title or ticket number", () => {
    expect(matches({ ...emptyFilters, query: "LOGIN" }, task())).toBe(true);
    expect(matches({ ...emptyFilters, query: "KAN-42" }, task())).toBe(true);
    expect(matches({ ...emptyFilters, query: "#42" }, task())).toBe(true);
    expect(matches({ ...emptyFilters, query: "signup" }, task())).toBe(false);
  });

  it("treats tasks without an assignee as unassigned", () => {
    const f = { ...emptyFilters, assignees: [UNASSIGNED] };
    expect(matches(f, task())).toBe(true);
    expect(matches(f, task({ assigneeId: "u1" }))).toBe(false);
  });

  it("treats tasks without a priority as no-priority", () => {
    const f = { ...emptyFilters, priorities: ["no-priority"] };
    expect(matches(f, task())).toBe(true);
    expect(matches(f, task({ priority: "high" }))).toBe(false);
  });
});

describe("filterCount", () => {
  it("counts every active filter except the text query", () => {
    expect(
      filterCount({
        ...emptyFilters,
        query: "x",
        labels: ["bug"],
        overdueOnly: true,
      }),
    ).toBe(2);
  });
});

describe("lanes", () => {
  const data: BoardData = {
    id: "p1",
    name: "Kaneo",
    slug: "kan",
    workspaceId: "w1",
    columns: [
      { id: "c1", slug: "to-do", name: "To do", tasks: [task()] },
      {
        id: "c2",
        slug: "done",
        name: "Done",
        isFinal: true,
        tasks: [task({ id: "t2", title: "Ship it" })],
      },
    ],
    plannedTasks: [task({ id: "t3", status: "planned" })],
    archivedTasks: [],
  };

  it("adds planned and archived lanes only when asked", () => {
    expect(
      lanes(data, emptyFilters, false, false).map((l) => l.status),
    ).toEqual(["to-do", "done"]);
    expect(lanes(data, emptyFilters, true, true).map((l) => l.status)).toEqual([
      "planned",
      "to-do",
      "done",
      "archived",
    ]);
  });

  it("filters tasks but keeps the unfiltered total", () => {
    const [todo, done] = lanes(
      data,
      { ...emptyFilters, query: "ship" },
      false,
      false,
    );
    expect(todo.tasks).toHaveLength(0);
    expect(todo.total).toBe(1);
    expect(done.tasks).toHaveLength(1);
    expect(done.isFinal).toBe(true);
  });
});
