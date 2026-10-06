import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock events to prevent side effects from ws/index.ts top-level subscriptions
vi.mock("../../../apps/api/src/events", () => ({
  subscribeToEvent: vi.fn(),
  publishEvent: vi.fn(),
}));

// Keeps the delivery path off the database. Tests that care about the audience
// override this; everyone else sees every task.
const { usersWhoCanSeeTasks } = vi.hoisted(() => ({
  usersWhoCanSeeTasks: vi.fn(
    async (_taskIds: string[], userIds: string[]) => new Set(userIds),
  ),
}));

vi.mock("../../../apps/api/src/utils/task-visibility", () => ({
  usersWhoCanSeeTasks,
}));

import {
  addConnection,
  broadcastToProject,
  initializeWebSocketAdapter,
  removeConnection,
  shutdownWebSocketAdapter,
} from "../../../apps/api/src/ws/index";

function makeFakeWs() {
  return {
    send: vi.fn(),
    close: vi.fn(),
    readyState: 1,
    raw: undefined,
    url: null,
    protocol: null,
  } as never;
}

describe("broadcastToProject", () => {
  beforeEach(async () => {
    // Ensure no REDIS_URL so InMemoryBroadcastAdapter is used
    delete process.env.REDIS_URL;
    usersWhoCanSeeTasks.mockImplementation(
      async (_taskIds: string[], userIds: string[]) => new Set(userIds),
    );
    await initializeWebSocketAdapter();
  });

  afterEach(async () => {
    await shutdownWebSocketAdapter();
  });

  it("delivers messages to connected clients after batch timeout", async () => {
    const ws = makeFakeWs();
    const conn = addConnection("proj-1", ws, "user-1", "init-1");

    broadcastToProject("proj-1", {
      type: "TASK_CREATED",
      projectId: "proj-1",
      taskId: "t1",
    });

    // Messages are batched with 100ms timeout
    expect(
      (ws as { send: ReturnType<typeof vi.fn> }).send,
    ).not.toHaveBeenCalled();

    // Wait for batch flush
    await vi.waitFor(
      () => {
        expect(
          (ws as { send: ReturnType<typeof vi.fn> }).send,
        ).toHaveBeenCalled();
      },
      { timeout: 300 },
    );

    const sent = JSON.parse(
      (ws as { send: ReturnType<typeof vi.fn> }).send.mock.calls[0][0],
    );
    expect(sent.type).toBe("TASK_CREATED");
    expect(sent.taskId).toBe("t1");

    removeConnection("proj-1", conn);
  });

  it("excludes connections matching excludeInitiatorId", async () => {
    const ws1 = makeFakeWs();
    const ws2 = makeFakeWs();
    const conn1 = addConnection("proj-1", ws1, "user-1", "init-excluded");
    const conn2 = addConnection("proj-1", ws2, "user-2", "init-other");

    broadcastToProject(
      "proj-1",
      { type: "TASK_UPDATED", projectId: "proj-1" },
      "init-excluded",
    );

    await vi.waitFor(
      () => {
        expect(
          (ws2 as { send: ReturnType<typeof vi.fn> }).send,
        ).toHaveBeenCalled();
      },
      { timeout: 300 },
    );

    expect(
      (ws1 as { send: ReturnType<typeof vi.fn> }).send,
    ).not.toHaveBeenCalled();

    removeConnection("proj-1", conn1);
    removeConnection("proj-1", conn2);
  });

  it("deduplicates messages with the same key in a batch window", async () => {
    const ws = makeFakeWs();
    const conn = addConnection("proj-1", ws, "user-1", "init-1");

    // Send two messages with the same type+taskId; they should be deduplicated
    broadcastToProject("proj-1", {
      type: "TASK_UPDATED",
      projectId: "proj-1",
      taskId: "t1",
    });
    broadcastToProject("proj-1", {
      type: "TASK_UPDATED",
      projectId: "proj-1",
      taskId: "t1",
    });

    await vi.waitFor(
      () => {
        expect(
          (ws as { send: ReturnType<typeof vi.fn> }).send,
        ).toHaveBeenCalled();
      },
      { timeout: 300 },
    );

    // Only one message should be delivered (deduplication by message key)
    expect(
      (ws as { send: ReturnType<typeof vi.fn> }).send,
    ).toHaveBeenCalledTimes(1);

    removeConnection("proj-1", conn);
  });

  it("does not deliver to connections on a different project", async () => {
    const ws = makeFakeWs();
    const conn = addConnection("proj-2", ws, "user-1", "init-1");

    broadcastToProject("proj-1", {
      type: "TASK_CREATED",
      projectId: "proj-1",
    });

    // Wait past the batch timeout
    await new Promise((r) => setTimeout(r, 200));

    expect(
      (ws as { send: ReturnType<typeof vi.fn> }).send,
    ).not.toHaveBeenCalled();

    removeConnection("proj-2", conn);
  });

  it("withholds a task event from users who cannot see that task", async () => {
    usersWhoCanSeeTasks.mockImplementation(
      async (taskIds: string[], userIds: string[]) =>
        new Set(
          taskIds.includes("owner-task")
            ? userIds.filter((id) => id !== "restricted-user")
            : userIds,
        ),
    );

    const allowedWs = makeFakeWs();
    const hiddenWs = makeFakeWs();
    const allowed = addConnection("proj-1", allowedWs, "admin-user", "init-1");
    const hidden = addConnection(
      "proj-1",
      hiddenWs,
      "restricted-user",
      "init-2",
    );

    broadcastToProject("proj-1", {
      type: "TASK_UPDATED",
      projectId: "proj-1",
      taskId: "owner-task",
    });

    await vi.waitFor(
      () => {
        expect(
          (allowedWs as { send: ReturnType<typeof vi.fn> }).send,
        ).toHaveBeenCalled();
      },
      { timeout: 300 },
    );

    expect(
      (hiddenWs as { send: ReturnType<typeof vi.fn> }).send,
    ).not.toHaveBeenCalled();
    expect(usersWhoCanSeeTasks).toHaveBeenCalledWith(
      ["owner-task"],
      expect.arrayContaining(["admin-user", "restricted-user"]),
    );

    removeConnection("proj-1", allowed);
    removeConnection("proj-1", hidden);
  });

  it("passes every referenced task id to the visibility check", async () => {
    const ws = makeFakeWs();
    const conn = addConnection("proj-1", ws, "user-1", "init-1");

    broadcastToProject("proj-1", {
      type: "TASK_RELATION_UPDATED",
      projectId: "proj-1",
      taskId: "",
      sourceTaskId: "source-task",
      targetTaskId: "target-task",
    });

    await vi.waitFor(
      () => {
        expect(usersWhoCanSeeTasks).toHaveBeenCalledWith(
          ["source-task", "target-task"],
          ["user-1"],
        );
      },
      { timeout: 300 },
    );

    removeConnection("proj-1", conn);
  });

  it("warns when called before adapter initialization", async () => {
    await shutdownWebSocketAdapter();
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    broadcastToProject("proj-1", {
      type: "TASK_CREATED",
      projectId: "proj-1",
    });

    expect(warnSpy).toHaveBeenCalledWith(
      "broadcastToProject called before adapter initialization",
    );
    warnSpy.mockRestore();
  });
});
