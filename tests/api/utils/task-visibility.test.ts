import type { Context } from "hono";
import { HTTPException } from "hono/http-exception";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { state, hasWorkspacePermission, userHasWorkspacePermission } =
  vi.hoisted(() => ({
    state: { results: [] as unknown[][] },
    hasWorkspacePermission: vi.fn(),
    userHasWorkspacePermission: vi.fn(),
  }));

vi.mock("../../../apps/api/src/database", async () => {
  const schema = await import("../../../apps/api/src/database/schema");

  // Every read in task-visibility ends in `.where(...)`, so the queued rows are
  // handed back there in call order.
  const chain = {
    select: () => chain,
    from: () => chain,
    innerJoin: () => chain,
    leftJoin: () => chain,
    where: () => Promise.resolve(state.results.shift() ?? []),
  };

  return { default: chain, schema };
});

vi.mock("../../../apps/api/src/utils/require-workspace-permission", () => ({
  hasWorkspacePermission,
  userHasWorkspacePermission,
}));

const {
  assertTasksVisible,
  clearTaskVisibilityCache,
  restrictedAssigneeId,
  usersWhoCanSeeTasks,
} = await import("../../../apps/api/src/utils/task-visibility");

function contextFor(userId: string) {
  return {
    get: (key: string) => (key === "userId" ? userId : "workspace-1"),
  } as unknown as Context;
}

beforeEach(() => {
  state.results.length = 0;
  hasWorkspacePermission.mockReset();
  userHasWorkspacePermission.mockReset();
  clearTaskVisibilityCache();
});

describe("restrictedAssigneeId", () => {
  it("does not restrict a user who can assign tasks", async () => {
    hasWorkspacePermission.mockResolvedValue(true);

    expect(await restrictedAssigneeId(contextFor("user-1"))).toBeUndefined();
  });

  it("restricts everyone else to their own id", async () => {
    hasWorkspacePermission.mockResolvedValue(false);

    expect(await restrictedAssigneeId(contextFor("user-1"))).toBe("user-1");
  });
});

describe("assertTasksVisible", () => {
  it("passes when every task is assigned to the restricted user", async () => {
    hasWorkspacePermission.mockResolvedValue(false);
    state.results.push([{ userId: "user-1" }, { userId: "user-1" }]);

    await expect(
      assertTasksVisible(contextFor("user-1"), "task", ["t1", "t2"]),
    ).resolves.toBeUndefined();
  });

  it("answers 404 when a task belongs to someone else", async () => {
    hasWorkspacePermission.mockResolvedValue(false);
    state.results.push([{ userId: "user-2" }]);

    const error = await assertTasksVisible(contextFor("user-1"), "task", [
      "t1",
    ]).catch((err: unknown) => err);

    expect(error).toBeInstanceOf(HTTPException);
    expect((error as HTTPException).status).toBe(404);
  });

  it("leaves an unclaimed task visible to a restricted user", async () => {
    hasWorkspacePermission.mockResolvedValue(false);
    state.results.push([{ userId: null }]);

    await expect(
      assertTasksVisible(contextFor("user-1"), "task", ["t1"]),
    ).resolves.toBeUndefined();
  });

  it("skips the check for a user who can assign tasks", async () => {
    hasWorkspacePermission.mockResolvedValue(true);

    await expect(
      assertTasksVisible(contextFor("user-1"), "task", ["t1"]),
    ).resolves.toBeUndefined();
    // No query was consumed, so the task table was never read.
    expect(state.results).toHaveLength(0);
  });

  it("resolves a comment to its task before checking", async () => {
    hasWorkspacePermission.mockResolvedValue(false);
    state.results.push([{ taskId: "t1" }], [{ userId: "user-2" }]);

    await expect(
      assertTasksVisible(contextFor("user-1"), "comment", ["c1"]),
    ).rejects.toBeInstanceOf(HTTPException);
  });

  it("leaves a workspace-wide label alone", async () => {
    hasWorkspacePermission.mockResolvedValue(false);
    state.results.push([{ taskId: null }]);

    await expect(
      assertTasksVisible(contextFor("user-1"), "label", ["l1"]),
    ).resolves.toBeUndefined();
  });

  it("does nothing when there is nothing to check", async () => {
    await expect(
      assertTasksVisible(contextFor("user-1"), "task", []),
    ).resolves.toBeUndefined();
    expect(hasWorkspacePermission).not.toHaveBeenCalled();
  });
});

describe("usersWhoCanSeeTasks", () => {
  it("keeps the whole audience when the event names no task", async () => {
    expect(await usersWhoCanSeeTasks([], ["user-1", "user-2"])).toEqual(
      new Set(["user-1", "user-2"]),
    );
    expect(userHasWorkspacePermission).not.toHaveBeenCalled();
  });

  it("includes the assignee and anyone who can assign tasks", async () => {
    state.results.push([{ assigneeId: "user-1", workspaceId: "workspace-1" }]);
    userHasWorkspacePermission.mockImplementation(
      async (userId: string) => userId === "admin-user",
    );

    expect(
      await usersWhoCanSeeTasks(["t1"], ["user-1", "user-2", "admin-user"]),
    ).toEqual(new Set(["user-1", "admin-user"]));
  });

  it("keeps the whole audience when the task is unclaimed", async () => {
    state.results.push([{ assigneeId: null, workspaceId: "workspace-1" }]);

    expect(await usersWhoCanSeeTasks(["t1"], ["user-1", "user-2"])).toEqual(
      new Set(["user-1", "user-2"]),
    );
    expect(userHasWorkspacePermission).not.toHaveBeenCalled();
  });

  it("keeps the whole audience when the task no longer exists", async () => {
    state.results.push([]);

    expect(await usersWhoCanSeeTasks(["deleted"], ["user-1"])).toEqual(
      new Set(["user-1"]),
    );
    expect(userHasWorkspacePermission).not.toHaveBeenCalled();
  });

  it("resolves a user's role once per cache window", async () => {
    state.results.push(
      [{ assigneeId: "user-1", workspaceId: "workspace-1" }],
      [{ assigneeId: "user-1", workspaceId: "workspace-1" }],
    );
    userHasWorkspacePermission.mockResolvedValue(false);

    await usersWhoCanSeeTasks(["t1"], ["user-2"]);
    await usersWhoCanSeeTasks(["t1"], ["user-2"]);

    expect(userHasWorkspacePermission).toHaveBeenCalledTimes(1);
  });
});
