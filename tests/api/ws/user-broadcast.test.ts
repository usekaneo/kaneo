import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../apps/api/src/events", () => ({
  subscribeToEvent: vi.fn(),
  publishEvent: vi.fn(),
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

describe("broadcastToUser", () => {
  const originalRedisUrl = process.env.REDIS_URL;

  beforeEach(async () => {
    delete process.env.REDIS_URL;
    await initializeWebSocketAdapter();
  });

  afterEach(async () => {
    await shutdownWebSocketAdapter();
    if (originalRedisUrl === undefined) {
      delete process.env.REDIS_URL;
    } else {
      process.env.REDIS_URL = originalRedisUrl;
    }
  });

  it("delivers a message to every socket the user has open", async () => {
    const first = makeFakeWs();
    const second = makeFakeWs();
    const connA = addUserConnection("user-1", first);
    const connB = addUserConnection("user-1", second);

    broadcastToUser("user-1", { type: "NOTIFICATION_CREATED" });

    await vi.waitFor(
      () => {
        expect(sendMock(first)).toHaveBeenCalled();
        expect(sendMock(second)).toHaveBeenCalled();
      },
      { timeout: 300 },
    );

    expect(JSON.parse(sendMock(first).mock.calls[0][0]).type).toBe(
      "NOTIFICATION_CREATED",
    );

    removeUserConnection("user-1", connA);
    removeUserConnection("user-1", connB);
  });

  it("does not deliver a message to a different user", async () => {
    const mine = makeFakeWs();
    const theirs = makeFakeWs();
    const connA = addUserConnection("user-1", mine);
    const connB = addUserConnection("user-2", theirs);

    broadcastToUser("user-1", { type: "NOTIFICATION_CREATED" });

    await vi.waitFor(
      () => {
        expect(sendMock(mine)).toHaveBeenCalled();
      },
      { timeout: 300 },
    );

    expect(sendMock(theirs)).not.toHaveBeenCalled();

    removeUserConnection("user-1", connA);
    removeUserConnection("user-2", connB);
  });

  it("still delivers locally when no adapter is initialised", async () => {
    await shutdownWebSocketAdapter();

    const ws = makeFakeWs();
    const conn = addUserConnection("user-1", ws);

    broadcastToUser("user-1", { type: "NOTIFICATION_CREATED" });
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(sendMock(ws)).toHaveBeenCalled();

    removeUserConnection("user-1", conn);
    await initializeWebSocketAdapter();
  });
});
