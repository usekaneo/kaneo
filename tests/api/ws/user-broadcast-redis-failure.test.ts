import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";

vi.mock("../../../apps/api/src/events", () => ({
  subscribeToEvent: vi.fn(),
  publishEvent: vi.fn(),
}));

const accessSync = vi.hoisted(() => vi.fn(async () => undefined));
const hasAccess = vi.hoisted(() => vi.fn(async () => false));
vi.mock("../../../apps/api/src/ws/workspace-access", () => ({
  syncWorkspaceAccess: accessSync,
  hasWorkspaceAccess: hasAccess,
}));
const sessionRows = vi.hoisted(() =>
  vi.fn(async (): Promise<Array<{ id: string }>> => []),
);
const apiKeyRows = vi.hoisted(() =>
  vi.fn(async (): Promise<Array<{ id: string }>> => []),
);
vi.mock("../../../apps/api/src/database", async () => {
  const schema = await import("../../../apps/api/src/database/schema");
  return {
    default: {
      select: () => ({
        from: (table: unknown) => ({
          where:
            table === schema.sessionTable
              ? sessionRows
              : table === schema.apikeyTable
                ? apiKeyRows
                : async () => [],
        }),
      }),
    },
    schema,
  };
});
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
  addConnection,
  removeConnection,
  broadcastToUser,
  initializeWebSocketAdapter,
  removeUserConnection,
  revokeApiKeyConnections,
  revokeSessionConnections,
  SESSION_ENDED_CLOSE_CODE,
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

function closeMock(ws: unknown) {
  return (ws as { close: ReturnType<typeof vi.fn> }).close;
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

describe("ended sessions with the redis adapter", () => {
  beforeEach(async () => {
    publish.mockReset().mockResolvedValue(1);
    listeners.length = 0;
    await initializeWebSocketAdapter();
  });

  afterEach(async () => {
    await shutdownWebSocketAdapter();
    sessionRows.mockReset().mockResolvedValue([]);
  });

  it("publishes the ended session IDs to the other instances", async () => {
    await revokeSessionConnections("user-1", ["session-a"]);

    await vi.waitFor(() => expect(publish).toHaveBeenCalledOnce());
    expect(JSON.parse(publish.mock.calls[0][1])).toMatchObject({
      userId: "user-1",
      message: { type: "SESSIONS_ENDED", sessionIds: ["session-a"] },
    });
  });

  it("closes only the ended session's sockets when another instance ends it", () => {
    const ended = makeFakeWs();
    const kept = makeFakeWs();
    const endedBoard = makeFakeWs();
    const connections = [
      addUserConnection("user-1", ended, "session-a"),
      addUserConnection("user-1", kept, "session-b"),
    ];
    const board = addConnection(
      "project",
      endedBoard,
      "user-1",
      "window",
      "workspace",
      undefined,
      "session-a",
    );
    try {
      emitUserBroadcast({
        userId: "user-1",
        origin: "other-instance",
        message: { type: "SESSIONS_ENDED", sessionIds: ["session-a"] },
      });

      for (const ws of [ended, endedBoard])
        expect(closeMock(ws)).toHaveBeenCalledWith(
          SESSION_ENDED_CLOSE_CODE,
          "Session ended",
        );
      expect(closeMock(kept)).not.toHaveBeenCalled();
      expect(sendMock(kept)).not.toHaveBeenCalled();
    } finally {
      for (const conn of connections) removeUserConnection("user-1", conn);
      removeConnection("project", board);
    }
  });

  it("closes the sockets of sessions that ended while the subscriber was away", async () => {
    sessionRows.mockResolvedValue([{ id: "session-b" }]);
    const ended = makeFakeWs();
    const kept = makeFakeWs();
    const apiKey = makeFakeWs();
    const endedBoard = makeFakeWs();
    const connections = [
      addUserConnection("user-1", ended, "session-a"),
      addUserConnection("user-1", kept, "session-b"),
      addUserConnection("user-1", apiKey),
    ];
    const board = addConnection(
      "project",
      endedBoard,
      "user-1",
      "window",
      "workspace",
      undefined,
      "session-c",
    );
    try {
      const ready = subscriber.on.mock.calls
        .filter(([event]) => event === "ready")
        .at(-1)?.[1];
      ready?.("", "", "");

      await vi.waitFor(() =>
        expect(closeMock(ended)).toHaveBeenCalledWith(
          SESSION_ENDED_CLOSE_CODE,
          "Session ended",
        ),
      );
      expect(closeMock(endedBoard)).toHaveBeenCalledWith(
        SESSION_ENDED_CLOSE_CODE,
        "Session ended",
      );
      expect(closeMock(kept)).not.toHaveBeenCalled();
      expect(closeMock(apiKey)).not.toHaveBeenCalled();
      expect(sessionRows).toHaveBeenCalledOnce();
    } finally {
      for (const conn of connections) removeUserConnection("user-1", conn);
      removeConnection("project", board);
    }
  });
});

describe("revoked API keys with the redis adapter", () => {
  beforeEach(async () => {
    publish.mockReset().mockResolvedValue(1);
    listeners.length = 0;
    await initializeWebSocketAdapter();
  });

  afterEach(async () => {
    await shutdownWebSocketAdapter();
    apiKeyRows.mockReset().mockResolvedValue([]);
    sessionRows.mockReset().mockResolvedValue([]);
  });

  function connectKeySockets() {
    const revoked = makeFakeWs();
    const kept = makeFakeWs();
    const session = makeFakeWs();
    const revokedBoard = makeFakeWs();
    const connections = [
      addUserConnection("user-1", revoked, null, "key-a"),
      addUserConnection("user-1", kept, null, "key-b"),
      addUserConnection("user-1", session, "session-a"),
    ];
    const board = addConnection(
      "project",
      revokedBoard,
      "user-1",
      "window",
      "workspace",
      "key-a",
    );
    return {
      closed: [revoked, revokedBoard],
      open: [kept, session],
      disconnect() {
        for (const conn of connections) removeUserConnection("user-1", conn);
        removeConnection("project", board);
      },
    };
  }

  it("publishes the revoked key IDs to the other instances", async () => {
    await revokeApiKeyConnections("user-1", ["key-a"]);

    await vi.waitFor(() => expect(publish).toHaveBeenCalledOnce());
    expect(JSON.parse(publish.mock.calls[0][1])).toMatchObject({
      userId: "user-1",
      message: { type: "API_KEYS_REVOKED", apiKeyIds: ["key-a"] },
    });
  });

  it("closes only the key's sockets when another instance revokes it", () => {
    const sockets = connectKeySockets();
    try {
      emitUserBroadcast({
        userId: "user-1",
        origin: "other-instance",
        message: { type: "API_KEYS_REVOKED", apiKeyIds: ["key-a"] },
      });

      for (const ws of sockets.closed)
        expect(closeMock(ws)).toHaveBeenCalledWith(1008, "API key revoked");
      for (const ws of sockets.open) {
        expect(closeMock(ws)).not.toHaveBeenCalled();
        expect(sendMock(ws)).not.toHaveBeenCalled();
      }
    } finally {
      sockets.disconnect();
    }
  });

  it("closes the sockets of keys revoked while the subscriber was away", async () => {
    apiKeyRows.mockResolvedValue([{ id: "key-b" }]);
    sessionRows.mockResolvedValue([{ id: "session-a" }]);
    const sockets = connectKeySockets();
    try {
      const ready = subscriber.on.mock.calls
        .filter(([event]) => event === "ready")
        .at(-1)?.[1];
      ready?.("", "", "");

      await vi.waitFor(() => {
        for (const ws of sockets.closed)
          expect(closeMock(ws)).toHaveBeenCalledWith(1008, "API key revoked");
      });
      for (const ws of sockets.open)
        expect(closeMock(ws)).not.toHaveBeenCalled();
      expect(apiKeyRows).toHaveBeenCalledOnce();
    } finally {
      sockets.disconnect();
    }
  });
});

it("resynchronizes healthy browser sockets after the Redis subscriber recovers", async () => {
  await initializeWebSocketAdapter();
  const ws = makeFakeWs();
  const conn = addUserConnection("user-1", ws);
  const ready = subscriber.on.mock.calls.find(
    ([event]) => event === "ready",
  )?.[1];
  expect(ready).toBeDefined();
  ready?.("", "", "");
  await vi.waitFor(() => expect(accessSync).toHaveBeenCalledWith("user-1", ws));
  removeUserConnection("user-1", conn);
  await shutdownWebSocketAdapter();
  accessSync.mockClear();
  ready?.("", "", "");
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(accessSync).not.toHaveBeenCalled();
});

it("ignores an offline-queued revocation after the member regains access", async () => {
  await initializeWebSocketAdapter();
  hasAccess.mockResolvedValue(true);
  const ws = makeFakeWs();
  const projectWs = makeFakeWs();
  const userConnection = addUserConnection("user-1", ws);
  const projectConnection = addConnection(
    "project",
    projectWs,
    "user-1",
    "window",
    "workspace",
  );
  emitUserBroadcast({
    userId: "user-1",
    origin: "other-instance",
    message: { type: "WORKSPACE_ACCESS_REVOKED", workspaceId: "workspace" },
  });
  await vi.waitFor(() =>
    expect(hasAccess).toHaveBeenCalledWith("user-1", "workspace"),
  );
  await Promise.resolve();
  expect(sendMock(ws)).not.toHaveBeenCalled();
  expect(
    (projectWs as unknown as { close: ReturnType<typeof vi.fn> }).close,
  ).not.toHaveBeenCalled();
  hasAccess.mockResolvedValue(false);
  emitUserBroadcast({
    userId: "user-1",
    origin: "other-instance",
    message: { type: "WORKSPACE_ACCESS_REVOKED", workspaceId: "workspace" },
  });
  await vi.waitFor(() => expect(sendMock(ws)).toHaveBeenCalledOnce());
  expect(
    (projectWs as unknown as { close: ReturnType<typeof vi.fn> }).close,
  ).toHaveBeenCalledWith(1008, "Workspace access revoked");
  removeUserConnection("user-1", userConnection);
  removeConnection("project", projectConnection);
  await shutdownWebSocketAdapter();
});

it.each([true, false])(
  "retries incoming revocation validation without evicting on database errors (restored=%s)",
  async (restored) => {
    vi.useFakeTimers();
    await initializeWebSocketAdapter();
    hasAccess.mockRejectedValue(new Error("database unavailable"));
    const ws = makeFakeWs();
    const projectWs = makeFakeWs();
    const userConnection = addUserConnection("user-1", ws);
    const projectConnection = addConnection(
      "project",
      projectWs,
      "user-1",
      "window",
      "workspace",
    );
    try {
      emitUserBroadcast({
        userId: "user-1",
        origin: "other-instance",
        message: { type: "WORKSPACE_ACCESS_REVOKED", workspaceId: "workspace" },
      });
      await vi.advanceTimersByTimeAsync(1000);
      expect(sendMock(ws)).not.toHaveBeenCalled();
      expect(
        (projectWs as unknown as { close: ReturnType<typeof vi.fn> }).close,
      ).not.toHaveBeenCalled();
      hasAccess.mockResolvedValue(restored);
      await vi.advanceTimersByTimeAsync(2000);
      expect(sendMock(ws)).toHaveBeenCalledTimes(restored ? 0 : 1);
      if (!restored)
        expect(
          (projectWs as unknown as { close: ReturnType<typeof vi.fn> }).close,
        ).toHaveBeenCalledWith(1008, "Workspace access revoked");
    } finally {
      removeUserConnection("user-1", userConnection);
      removeConnection("project", projectConnection);
      await shutdownWebSocketAdapter();
      hasAccess.mockResolvedValue(false);
      vi.useRealTimers();
    }
  },
);
