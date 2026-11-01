import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

const put = vi.fn();
vi.mock("@kaneo/libs", () => ({
  client: {
    task: { assignee: { ":id": { $put: (arg: unknown) => put(arg) } } },
  },
}));

import updateTaskAssignee from "./update-task-assignee";

describe("updateTaskAssignee", () => {
  beforeEach(() => {
    put.mockReset();
    put.mockResolvedValue({ ok: true, json: async () => ({}) });
  });

  it("sends the chosen userId even when the spread task carries its own assigneeIds", async () => {
    // Board and list callers do `{ ...task, userId }`; a task already has assigneeIds.
    const task = { userId: "bob", assigneeIds: ["alice", "carol"] };
    await updateTaskAssignee("t1", task as never);
    expect(put).toHaveBeenCalledWith({
      param: { id: "t1" },
      json: { userId: "bob" },
    });
  });

  it("sends an empty userId to unassign", async () => {
    await updateTaskAssignee("t1", {
      userId: null,
      assigneeIds: ["alice"],
    } as never);
    expect(put.mock.calls[0][0].json).toEqual({ userId: "" });
  });

  it("sends the whole set only when explicitly replacing it", async () => {
    await updateTaskAssignee("t1", {
      userId: "alice",
      replaceAssigneeIds: ["alice", "bob"],
    } as never);
    expect(put.mock.calls[0][0].json).toEqual({
      assigneeIds: ["alice", "bob"],
    });
  });

  it("can clear the set explicitly", async () => {
    await updateTaskAssignee("t1", {
      userId: null,
      replaceAssigneeIds: [],
    } as never);
    expect(put.mock.calls[0][0].json).toEqual({ assigneeIds: [] });
  });
});
