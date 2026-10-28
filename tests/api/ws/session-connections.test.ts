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

import {
  addConnection,
  addUserConnection,
  broadcastToUser,
  initializeWebSocketAdapter,
  removeConnection,
  removeUserConnection,
  revokeSessionConnections,
  SESSION_ENDED_CLOSE_CODE,
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

function mocksOf(ws: unknown) {
  return ws as {
    send: ReturnType<typeof vi.fn>;
    close: ReturnType<typeof vi.fn>;
  };
}

describe("revokeSessionConnections", () => {
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

  it("closes only the sockets of the ended session and keeps delivering to the others", async () => {
    const firstTab = makeFakeWs();
    const secondTab = makeFakeWs();
    const phone = makeFakeWs();
    const apiKey = makeFakeWs();
    const endedBoard = makeFakeWs();
    const phoneBoard = makeFakeWs();
    const apiKeyBoard = makeFakeWs();
    const connections = [
      addUserConnection("user-1", firstTab, "session-a"),
      addUserConnection("user-1", secondTab, "session-a"),
      addUserConnection("user-1", phone, "session-b"),
      addUserConnection("user-1", apiKey),
    ];
    const boards = [
      addConnection(
        "project-1",
        endedBoard,
        "user-1",
        "user-1:a",
        "ws-1",
        undefined,
        "session-a",
      ),
      addConnection(
        "project-1",
        phoneBoard,
        "user-1",
        "user-1:b",
        "ws-1",
        undefined,
        "session-b",
      ),
      addConnection(
        "project-1",
        apiKeyBoard,
        "user-1",
        "user-1:key",
        "ws-1",
        "api-key-1",
      ),
    ];

    expect(boards[2]).toMatchObject({
      apiKeyId: "api-key-1",
      sessionId: null,
    });

    await revokeSessionConnections("user-1", ["session-a"]);

    for (const ws of [firstTab, secondTab, endedBoard]) {
      expect(mocksOf(ws).close).toHaveBeenCalledWith(
        SESSION_ENDED_CLOSE_CODE,
        "Session ended",
      );
      expect(mocksOf(ws).send).not.toHaveBeenCalled();
    }
    for (const ws of [phone, apiKey, phoneBoard, apiKeyBoard]) {
      expect(mocksOf(ws).close).not.toHaveBeenCalled();
      expect(mocksOf(ws).send).not.toHaveBeenCalled();
    }

    broadcastToUser("user-1", { type: "NOTIFICATION_CREATED" });

    await vi.waitFor(
      () => {
        for (const ws of [phone, apiKey])
          expect(mocksOf(ws).send).toHaveBeenCalledWith(
            JSON.stringify({ type: "NOTIFICATION_CREATED" }),
          );
      },
      { timeout: 300 },
    );
    expect(mocksOf(firstTab).send).not.toHaveBeenCalled();
    expect(mocksOf(secondTab).send).not.toHaveBeenCalled();

    for (const conn of connections) removeUserConnection("user-1", conn);
    for (const conn of boards) removeConnection("project-1", conn);
  });

  it("does nothing without session IDs", async () => {
    const ws = makeFakeWs();
    const conn = addUserConnection("user-1", ws, "session-a");

    await revokeSessionConnections("user-1", []);

    expect(mocksOf(ws).close).not.toHaveBeenCalled();
    removeUserConnection("user-1", conn);
  });
});
