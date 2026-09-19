import { beforeEach, describe, expect, it, vi } from "vitest";

const { state } = vi.hoisted(() => ({
  state: {
    lookups: [] as string[],
    assigneeByTask: {} as Record<string, string | null>,
    broadcasts: [] as Array<{
      userId: string;
      message: Record<string, unknown>;
    }>,
  },
}));

vi.mock("../../../apps/api/src/events", () => ({
  subscribeToEvent: vi.fn(),
  publishEvent: vi.fn(),
}));

vi.mock("../../../apps/api/src/ws", () => ({
  broadcastToUser: (userId: string, message: Record<string, unknown>) => {
    state.broadcasts.push({ userId, message });
  },
}));

vi.mock("../../../apps/api/src/database", async () => {
  const schema = await import("../../../apps/api/src/database/schema");
  const { PgDialect } = await import("drizzle-orm/pg-core");
  const dialect = new PgDialect();
  let boundId: string | undefined;

  const chain = {
    select: () => chain,
    from: () => chain,
    where: (condition: Parameters<typeof dialect.sqlToQuery>[0]) => {
      const [id] = dialect.sqlToQuery(condition).params;
      boundId = typeof id === "string" ? id : undefined;
      return chain;
    },
    limit: async () => {
      if (!boundId) return [];
      state.lookups.push(boundId);
      return boundId in state.assigneeByTask
        ? [{ userId: state.assigneeByTask[boundId] }]
        : [];
    },
  };

  return { default: chain, schema };
});

const { subscribeToEvent } = await import("../../../apps/api/src/events");
const {
  notifyAssignees,
  registerAssignedTasksRealtime,
  resolveAffectedAssignees,
} = await import("../../../apps/api/src/task/assigned-tasks-realtime");

describe("assigned tasks realtime", () => {
  beforeEach(() => {
    state.lookups = [];
    state.assigneeByTask = { "task-1": "user-current" };
    state.broadcasts = [];
  });

  it("reads the assignee from `userId` on task.created only", async () => {
    await expect(
      resolveAffectedAssignees("task.created", {
        taskId: "task-1",
        userId: "user-assignee",
      }),
    ).resolves.toEqual(["user-assignee"]);

    // Everywhere else `userId` is the actor and must not be notified.
    await expect(
      resolveAffectedAssignees("task.priority_changed", {
        taskId: "task-1",
        userId: "user-actor",
      }),
    ).resolves.toEqual(["user-current"]);
  });

  it("notifies both sides of an assignee change without a lookup", async () => {
    const assignees = await resolveAffectedAssignees("task.assignee_changed", {
      taskId: "task-1",
      userId: "user-actor",
      oldAssignee: "user-old",
      newAssigneeId: "user-new",
    });

    expect(assignees.sort()).toEqual(["user-new", "user-old"]);
    expect(state.lookups).toEqual([]);
  });

  it("uses the enriched payload for unassign, delete and full updates", async () => {
    await expect(
      resolveAffectedAssignees("task.unassigned", {
        taskId: "task-1",
        previousAssigneeId: "user-old",
      }),
    ).resolves.toEqual(["user-old"]);

    await expect(
      resolveAffectedAssignees("task.deleted", {
        taskId: "task-gone",
        assigneeId: "user-old",
      }),
    ).resolves.toEqual(["user-old"]);

    const updated = await resolveAffectedAssignees("task.updated", {
      taskId: "task-1",
      assigneeId: "user-new",
      previousAssigneeId: "user-old",
    });
    expect(updated.sort()).toEqual(["user-new", "user-old"]);
    expect(state.lookups).toEqual([]);
  });

  it("does not look up a deleted task", async () => {
    await expect(
      resolveAffectedAssignees("task.deleted", { taskId: "task-gone" }),
    ).resolves.toEqual([]);
    expect(state.lookups).toEqual([]);
  });

  it("falls back to the task's current assignee for label and move events", async () => {
    await expect(
      resolveAffectedAssignees("task.label_assigned", { taskId: "task-1" }),
    ).resolves.toEqual(["user-current"]);
    await expect(
      resolveAffectedAssignees("task.moved", { taskId: "task-1" }),
    ).resolves.toEqual(["user-current"]);
    expect(state.lookups).toEqual(["task-1", "task-1"]);
  });

  it("stays silent for unassigned tasks", async () => {
    state.assigneeByTask = { "task-1": null };
    await expect(
      resolveAffectedAssignees("task.due_date_changed", { taskId: "task-1" }),
    ).resolves.toEqual([]);
  });

  it("subscribes once no matter how many apps are created", () => {
    registerAssignedTasksRealtime();
    const subscriptions = vi.mocked(subscribeToEvent).mock.calls.length;
    expect(subscriptions).toBeGreaterThan(0);

    registerAssignedTasksRealtime();
    expect(vi.mocked(subscribeToEvent).mock.calls.length).toBe(subscriptions);
  });

  it("broadcasts one user message per assignee with the destination project", () => {
    notifyAssignees(
      "task.moved",
      { taskId: "task-1", toProjectId: "project-b", projectId: undefined },
      ["user-a", "user-b"],
    );

    expect(state.broadcasts).toEqual([
      {
        userId: "user-a",
        message: {
          type: "ASSIGNED_TASKS_UPDATED",
          taskId: "task-1",
          projectId: "project-b",
          event: "task.moved",
        },
      },
      {
        userId: "user-b",
        message: {
          type: "ASSIGNED_TASKS_UPDATED",
          taskId: "task-1",
          projectId: "project-b",
          event: "task.moved",
        },
      },
    ]);
  });
});
