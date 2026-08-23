import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../apps/api/src/events", () => ({
  subscribeToEvent: vi.fn(),
  publishEvent: vi.fn(),
}));

const publish = vi.fn();
const listeners: Array<(p: string, c: string, d: string) => void> = [];
const subscriber = {
  psubscribe: vi.fn().mockResolvedValue(undefined),
  punsubscribe: vi.fn().mockResolvedValue(undefined),
  on: vi.fn((event: string, fn: (p: string, c: string, d: string) => void) => {
    if (event === "pmessage") listeners.push(fn);
  }),
  off: vi.fn(
    (_event: string, fn: (p: string, c: string, d: string) => void) => {
      const i = listeners.indexOf(fn);
      if (i >= 0) listeners.splice(i, 1);
    },
  ),
};

vi.mock("../../../apps/api/src/redis", () => ({
  isRedisConfigured: () => true,
  getRedisPub: () => ({ publish }),
  getRedisSub: () => subscriber,
  closeRedis: vi.fn().mockResolvedValue(undefined),
}));

import {
  addUserConnection,
  broadcastToUser,
  initializeWebSocketAdapter,
  removeUserConnection,
  shutdownWebSocketAdapter,
} from "../../../apps/api/src/ws/index";

const USER_PATTERN = "kaneo:ws-user:*:broadcast";

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

function sendMock(ws: unknown) {
  return (ws as { send: ReturnType<typeof vi.fn> }).send;
}

function emitUserBroadcast(payload: unknown, channelUserId = "user-1") {
  const data = JSON.stringify(payload);
  for (const fn of [...listeners]) {
    fn(USER_PATTERN, `kaneo:ws-user:${channelUserId}:broadcast`, data);
  }
}

describe("broadcastToUser with the redis adapter", () => {
  beforeEach(async () => {
    publish.mockReset().mockResolvedValue(1);
    listeners.length = 0;
    await initializeWebSocketAdapter();
  });

  afterEach(async () => {
    await shutdownWebSocketAdapter();
  });

  it("delivers to local sockets without waiting on redis", async () => {
    const ws = makeFakeWs();
    const conn = addUserConnection("user-1", ws);

    broadcastToUser("user-1", { type: "NOTIFICATION_CREATED" });

    expect(sendMock(ws)).toHaveBeenCalledTimes(1);
    expect(JSON.parse(sendMock(ws).mock.calls[0][0]).type).toBe(
      "NOTIFICATION_CREATED",
    );

    removeUserConnection("user-1", conn);
  });

  it("still delivers locally when the publish fails", async () => {
    publish.mockRejectedValue(new Error("redis is down"));

    const ws = makeFakeWs();
    const conn = addUserConnection("user-1", ws);

    broadcastToUser("user-1", { type: "NOTIFICATION_CREATED" });
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(sendMock(ws)).toHaveBeenCalledTimes(1);

    removeUserConnection("user-1", conn);
  });

  it("ignores its own echo so the socket is written once", async () => {
    const ws = makeFakeWs();
    const conn = addUserConnection("user-1", ws);

    broadcastToUser("user-1", { type: "NOTIFICATION_CREATED" });
    expect(publish).toHaveBeenCalledTimes(1);

    const published = JSON.parse(publish.mock.calls[0][1]);
    expect(published.origin).toEqual(expect.any(String));

    emitUserBroadcast(published);

    expect(sendMock(ws)).toHaveBeenCalledTimes(1);

    removeUserConnection("user-1", conn);
  });

  it("delivers a broadcast published by another instance", async () => {
    const ws = makeFakeWs();
    const conn = addUserConnection("user-1", ws);

    emitUserBroadcast({
      userId: "user-1",
      message: { type: "NOTIFICATION_CREATED" },
      origin: "some-other-instance",
    });

    expect(sendMock(ws)).toHaveBeenCalledTimes(1);

    removeUserConnection("user-1", conn);
  });

  it("drops a message whose payload disagrees with its channel", async () => {
    const ws = makeFakeWs();
    const conn = addUserConnection("user-1", ws);

    emitUserBroadcast(
      {
        userId: "user-1",
        message: { type: "NOTIFICATION_CREATED" },
        origin: "some-other-instance",
      },
      "user-2",
    );

    expect(sendMock(ws)).not.toHaveBeenCalled();

    removeUserConnection("user-1", conn);
  });
});
