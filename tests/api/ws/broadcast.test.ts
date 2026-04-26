import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock events to prevent side effects from ws/index.ts top-level subscriptions
vi.mock("../../../apps/api/src/events", () => ({
  subscribeToEvent: vi.fn(),
  publishEvent: vi.fn(),
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

    // Send two messages with the same type+taskId — should be deduplicated
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
