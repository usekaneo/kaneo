import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../apps/api/src/events", () => ({
  subscribeToEvent: vi.fn(),
  publishEvent: vi.fn(),
}));

const publish = vi.fn();
const psubscribe = vi.fn().mockResolvedValue(undefined);
const punsubscribe = vi.fn().mockResolvedValue(undefined);

vi.mock("../../../apps/api/src/redis", () => ({
  isRedisConfigured: () => true,
  getRedisPub: () => ({ publish }),
  getRedisSub: () => ({
    psubscribe,
    punsubscribe,
    on: vi.fn(),
    off: vi.fn(),
  }),
  closeRedis: vi.fn().mockResolvedValue(undefined),
}));

import {
  addUserConnection,
  broadcastToUser,
  initializeWebSocketAdapter,
  removeUserConnection,
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

function sendMock(ws: unknown) {
  return (ws as { send: ReturnType<typeof vi.fn> }).send;
}

describe("broadcastToUser when the adapter publish fails", () => {
  beforeEach(async () => {
    publish.mockReset();
    await initializeWebSocketAdapter();
  });

  afterEach(async () => {
    await shutdownWebSocketAdapter();
  });

  it("still delivers to sockets on this instance", async () => {
    publish.mockRejectedValue(new Error("redis is down"));

    const ws = makeFakeWs();
    const conn = addUserConnection("user-1", ws);

    broadcastToUser("user-1", { type: "NOTIFICATION_CREATED" });

    await vi.waitFor(
      () => {
        expect(sendMock(ws)).toHaveBeenCalled();
      },
      { timeout: 300 },
    );

    expect(JSON.parse(sendMock(ws).mock.calls[0][0]).type).toBe(
      "NOTIFICATION_CREATED",
    );

    removeUserConnection("user-1", conn);
  });

  it("does not double-deliver when the publish succeeds", async () => {
    publish.mockResolvedValue(1);

    const ws = makeFakeWs();
    const conn = addUserConnection("user-1", ws);

    broadcastToUser("user-1", { type: "NOTIFICATION_CREATED" });
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(publish).toHaveBeenCalledTimes(1);
    expect(sendMock(ws)).not.toHaveBeenCalled();

    removeUserConnection("user-1", conn);
  });
});
