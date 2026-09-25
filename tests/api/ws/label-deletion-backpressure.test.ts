import type { WSContext } from "hono/ws";
import { afterEach, describe, expect, it, vi } from "vitest";
import { eventContext, publishEvent } from "../../../apps/api/src/events";
import {
  addConnection,
  initializeWebSocketAdapter,
  removeConnection,
  shutdownWebSocketAdapter,
} from "../../../apps/api/src/ws";

const m = vi.hoisted(() => ({
  redis: false,
  publish: vi.fn(),
  sub: {
    on: vi.fn(),
    off: vi.fn(),
    psubscribe: vi.fn(),
    punsubscribe: vi.fn(),
  },
}));
vi.mock("../../../apps/api/src/redis", () => ({
  isRedisConfigured: () => m.redis,
  getRedisPub: () => ({ publish: m.publish }),
  getRedisSub: () => m.sub,
  closeRedis: vi.fn(),
}));
afterEach(async () => {
  await shutdownWebSocketAdapter();
  vi.clearAllMocks();
});

describe("awaited label deletion broadcasts", () => {
  it("delivers immediately through the real in-memory adapter and excludes the initiator", async () => {
    m.redis = false;
    await initializeWebSocketAdapter();
    const observer = { send: vi.fn() };
    const initiator = { send: vi.fn() };
    const foreign = { send: vi.fn() };
    const connections = [
      [
        "project",
        addConnection(
          "project",
          observer as unknown as WSContext,
          "observer",
          "other",
        ),
      ],
      [
        "project",
        addConnection(
          "project",
          initiator as unknown as WSContext,
          "initiator",
          "self",
        ),
      ],
      [
        "foreign",
        addConnection(
          "foreign",
          foreign as unknown as WSContext,
          "foreign",
          "another",
        ),
      ],
    ] as const;
    try {
      await eventContext.run({ initiatorId: "self" }, () =>
        publishEvent(
          "task.label_deleted",
          { projectId: "project", taskId: "task" },
          { waitForHandlers: true },
        ),
      );
      expect(observer.send).toHaveBeenCalledTimes(1);
      expect(JSON.parse(observer.send.mock.calls[0][0])).toEqual({
        type: "TASK_LABEL_UPDATED",
        projectId: "project",
        taskId: "task",
      });
      expect(initiator.send).not.toHaveBeenCalled();
      expect(foreign.send).not.toHaveBeenCalled();
    } finally {
      for (const [project, connection] of connections)
        removeConnection(project, connection);
    }
  });

  it("does not complete the event while the real Redis adapter is awaiting publication", async () => {
    m.redis = true;
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    m.publish.mockImplementation(() => gate);
    await initializeWebSocketAdapter();
    let completed = false;
    const operation = publishEvent(
      "task.label_deleted",
      { projectId: "project", taskId: "task" },
      { waitForHandlers: true },
    ).then(() => {
      completed = true;
    });
    try {
      await vi.waitFor(() => expect(m.publish).toHaveBeenCalledTimes(1));
      expect(completed).toBe(false);
      expect(m.publish.mock.calls[0][0]).toBe("kaneo:ws:project:broadcast");
      expect(JSON.parse(m.publish.mock.calls[0][1])).toMatchObject({
        projectId: "project",
        message: { type: "TASK_LABEL_UPDATED", taskId: "task" },
      });
    } finally {
      release();
    }
    await operation;
    expect(completed).toBe(true);
  });
});
