import { describe, expect, it } from "vite-plus/test";
import { matchesWorkspaceBoardQuery } from "./matches-workspace-board-query";

const task = {
  projectId: "p1",
  status: "todo",
  priority: "high",
  userId: "u1",
  dueDate: "2026-10-07T12:00:00.000Z",
};

describe("matchesWorkspaceBoardQuery", () => {
  it("matches when the query has no filters", () => {
    expect(matchesWorkspaceBoardQuery(task, {})).toBe(true);
  });

  it("checks every comma-separated filter", () => {
    const query = {
      projectIds: "p1,p2",
      status: "todo",
      priority: "high,urgent",
      assigneeIds: "u1",
    };

    expect(matchesWorkspaceBoardQuery(task, query)).toBe(true);
    expect(matchesWorkspaceBoardQuery({ ...task, userId: "u2" }, query)).toBe(
      false,
    );
    expect(
      matchesWorkspaceBoardQuery({ ...task, projectId: "p3" }, query),
    ).toBe(false);
  });

  it("treats a task without an assignee as unassigned", () => {
    const unassigned = { ...task, userId: null };

    expect(
      matchesWorkspaceBoardQuery(unassigned, { assigneeIds: "unassigned,u2" }),
    ).toBe(true);
    expect(matchesWorkspaceBoardQuery(unassigned, { assigneeIds: "u1" })).toBe(
      false,
    );
  });

  it("applies the due date range and drops undated tasks from it", () => {
    const query = {
      dueAfter: "2026-10-05T00:00:00.000Z",
      dueBefore: "2026-10-11T23:59:59.999Z",
    };

    expect(matchesWorkspaceBoardQuery(task, query)).toBe(true);
    expect(
      matchesWorkspaceBoardQuery(
        { ...task, dueDate: "2026-10-12T08:00:00.000Z" },
        query,
      ),
    ).toBe(false);
    expect(matchesWorkspaceBoardQuery({ ...task, dueDate: null }, query)).toBe(
      false,
    );
  });

  it("cannot decide a label filter unless another filter already fails", () => {
    expect(
      matchesWorkspaceBoardQuery(task, { labelIds: "l1" }),
    ).toBeUndefined();
    expect(
      matchesWorkspaceBoardQuery(task, { labelIds: "l1", status: "done" }),
    ).toBe(false);
  });
});
