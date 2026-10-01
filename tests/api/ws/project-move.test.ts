import type { WSContext } from "hono/ws";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import {
  addConnection,
  addUserConnection,
  removeUserConnection,
  broadcastToProject,
  closeProjectConnections,
  initializeWebSocketAdapter,
  removeConnection,
  revokeWorkspaceConnections,
  revokeUserConnections,
  shutdownWebSocketAdapter,
} from "../../../apps/api/src/ws";

const m = vi.hoisted(() => ({
  lookup: vi.fn(),
  members: vi.fn(),
  admins: vi.fn(),
  redis: false,
  publish: vi.fn(),
  on: vi.fn(),
}));
vi.mock("../../../apps/api/src/database", () => ({
  default: {
    select: (fields: Record<string, unknown>) => ({
      from: () => ({
        where: () =>
          fields.role
            ? m.admins()
            : fields.userId
              ? m.members()
              : { limit: m.lookup },
      }),
    }),
  },
}));
vi.mock("../../../apps/api/src/events", () => ({ subscribeToEvent: vi.fn() }));
vi.mock("../../../apps/api/src/redis", () => ({
  isRedisConfigured: () => m.redis,
  getRedisPub: () => ({ publish: m.publish }),
  getRedisSub: () => ({
    on: m.on,
    off: vi.fn(),
    psubscribe: vi.fn(),
    punsubscribe: vi.fn(),
  }),
  closeRedis: vi.fn(),
}));
const tracked: Array<[string, ReturnType<typeof addConnection>]> = [];
function connect(projectId = "project", workspaceId = "old") {
  const ws = { send: vi.fn(), close: vi.fn() };
  tracked.push([
    projectId,
    addConnection(
      projectId,
      ws as unknown as WSContext,
      "user",
      "window",
      workspaceId,
    ),
  ]);
  return ws;
}
const update = {
  type: "TASK_UPDATED",
  projectId: "project",
  taskId: "private-task",
};
beforeEach(() => {
  m.redis = false;
  m.admins.mockResolvedValue([]);
  m.members.mockResolvedValue([{ userId: "user" }]);
  m.lookup.mockResolvedValue([{ workspaceId: "old" }]);
  m.publish.mockResolvedValue(1);
});
afterEach(async () => {
  await shutdownWebSocketAdapter();
  for (const [id, conn] of tracked.splice(0)) removeConnection(id, conn);
  vi.clearAllMocks();
  vi.useRealTimers();
});
describe("project move revocation", () => {
  it("closes local connections and discards queued updates without touching another project", async () => {
    vi.useFakeTimers();
    await initializeWebSocketAdapter();
    const old = connect();
    const other = connect("other");
    broadcastToProject("project", update);
    await closeProjectConnections("project");
    await vi.advanceTimersByTimeAsync(100);
    expect(old.close).toHaveBeenCalledWith(1008, "Project workspace changed");
    expect(old.send.mock.calls.map(([data]) => JSON.parse(data).type)).toEqual([
      "PROJECT_MOVED",
    ]);
    expect(other.close).not.toHaveBeenCalled();
  });
  it("rejects stale workspace connections even when revocation was missed", async () => {
    vi.useFakeTimers();
    await initializeWebSocketAdapter();
    const old = connect();
    const current = connect("project", "new");
    m.lookup.mockResolvedValue([{ workspaceId: "new" }]);
    broadcastToProject("project", update);
    await vi.advanceTimersByTimeAsync(100);
    expect(old.send).not.toHaveBeenCalled();
    expect(old.close).toHaveBeenCalled();
    expect(current.send).toHaveBeenCalledWith(JSON.stringify(update));
  });
  it.each(["workspace", "membership"])(
    "skips delivery without revoking access on transient %s lookup failure",
    async (lookup) => {
      vi.useFakeTimers();
      await initializeWebSocketAdapter();
      const old = connect();
      (lookup === "workspace" ? m.lookup : m.members).mockRejectedValueOnce(
        new Error("Database unavailable"),
      );
      broadcastToProject("project", update);
      await vi.advanceTimersByTimeAsync(100);
      expect(old.send).not.toHaveBeenCalled();
      expect(old.close).not.toHaveBeenCalled();
      broadcastToProject("project", update);
      await vi.advanceTimersByTimeAsync(100);
      expect(old.send).toHaveBeenCalledWith(JSON.stringify(update));
    },
  );
  it("does not send an in-flight update after local revocation", async () => {
    vi.useFakeTimers();
    await initializeWebSocketAdapter();
    const old = connect();
    let finish!: (value: Array<{ workspaceId: string }>) => void;
    m.lookup.mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    broadcastToProject("project", update);
    await vi.advanceTimersByTimeAsync(100);
    await closeProjectConnections("project");
    finish([{ workspaceId: "old" }]);
    await vi.advanceTimersByTimeAsync(0);
    expect(old.send.mock.calls.map(([data]) => JSON.parse(data).type)).toEqual([
      "PROJECT_MOVED",
    ]);
  });
  it("revokes sockets when a move arrives through Redis", async () => {
    m.redis = true;
    await initializeWebSocketAdapter();
    const old = connect();
    const handler = m.on.mock.calls[0][1];
    handler(
      "kaneo:ws:*:broadcast",
      "kaneo:ws:project:broadcast",
      JSON.stringify({
        projectId: "project",
        message: { type: "PROJECT_MOVED", projectId: "project" },
      }),
    );
    expect(old.close).toHaveBeenCalled();
  });
  it("closes local sockets even if Redis publication fails", async () => {
    m.redis = true;
    await initializeWebSocketAdapter();
    const old = connect();
    m.publish.mockRejectedValueOnce(new Error("Redis unavailable"));
    await expect(closeProjectConnections("project")).resolves.toBeUndefined();
    expect(old.close).toHaveBeenCalled();
  });
});

describe("workspace membership revocation", () => {
  it("preserves instance-admin access after membership removal, but forces account revocation", async () => {
    await initializeWebSocketAdapter();
    const ws = connect();
    m.admins.mockResolvedValue([{ userId: "user", role: "user,admin" }]);
    await revokeWorkspaceConnections("user", "old");
    expect(ws.close).not.toHaveBeenCalled();
    await revokeWorkspaceConnections("user", "old", { force: true });
    expect(ws.close).toHaveBeenCalled();
  });
  it("notifies user sockets even without an open project", async () => {
    await initializeWebSocketAdapter();
    const ws = { send: vi.fn(), close: vi.fn() };
    const conn = addUserConnection("user", ws as unknown as WSContext);
    try {
      await revokeWorkspaceConnections("user", "old");
      expect(ws.send).toHaveBeenCalledWith(
        JSON.stringify({
          type: "WORKSPACE_ACCESS_REVOKED",
          workspaceId: "old",
        }),
      );
    } finally {
      removeUserConnection("user", conn);
    }
  });

  it("keeps instance admins connected without workspace membership", async () => {
    vi.useFakeTimers();
    await initializeWebSocketAdapter();
    const ws = connect();
    m.members.mockResolvedValue([]);
    m.admins.mockResolvedValue([{ userId: "user", role: "admin" }]);
    broadcastToProject("project", update);
    await vi.advanceTimersByTimeAsync(100);
    expect(ws.send).toHaveBeenCalledWith(JSON.stringify(update));
    expect(ws.close).not.toHaveBeenCalled();
  });

  it("stops broadcasts after membership removal even when fan-out was missed", async () => {
    vi.useFakeTimers();
    await initializeWebSocketAdapter();
    const ws = connect();
    m.members.mockResolvedValue([]);
    broadcastToProject("project", update);
    await vi.advanceTimersByTimeAsync(100);
    expect(ws.send).not.toHaveBeenCalled();
    expect(ws.close).toHaveBeenCalledWith(1008, "Workspace access revoked");
  });
  it("closes only the removed member's workspace subscriptions", async () => {
    await initializeWebSocketAdapter();
    const removed = connect();
    const unrelated = connect("other-project", "other-workspace");
    await revokeWorkspaceConnections("user", "old");
    expect(removed.close).toHaveBeenCalledWith(
      1008,
      "Workspace access revoked",
    );
    expect(unrelated.close).not.toHaveBeenCalled();
  });
  it("revokes remote subscriptions through the user Redis channel", async () => {
    m.redis = true;
    m.admins.mockResolvedValue([{ role: "user" }]);
    m.members.mockResolvedValue([]);
    await initializeWebSocketAdapter();
    const ws = connect();
    const handler = m.on.mock.calls[1][1];
    handler(
      "kaneo:ws-user:*:broadcast",
      "kaneo:ws-user:user:broadcast",
      JSON.stringify({
        userId: "user",
        origin: "remote-instance",
        message: { type: "WORKSPACE_ACCESS_REVOKED", workspaceId: "old" },
      }),
    );
    await vi.waitFor(() =>
      expect(ws.close).toHaveBeenCalledWith(1008, "Workspace access revoked"),
    );
  });
});

it("coalesces authorization checks across a bulk broadcast burst", async () => {
  vi.useFakeTimers();
  await initializeWebSocketAdapter();
  const connection = connect();
  for (let index = 0; index < 50; index++)
    broadcastToProject("project", { ...update, taskId: `task-${index}` });
  await vi.advanceTimersByTimeAsync(100);
  expect(connection.send).toHaveBeenCalledTimes(50);
  expect(m.members).toHaveBeenCalledTimes(1);
});

it("does not reuse an older flush's membership snapshot for a later Redis broadcast", async () => {
  m.redis = true;
  await initializeWebSocketAdapter();
  const connection = connect();
  const handler = m.on.mock.calls[0][1];
  let finish!: (rows: { userId: string }[]) => void;
  m.members
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    )
    .mockResolvedValueOnce([]);
  const receive = (authorizationBatch: string, taskId: string) =>
    handler(
      "kaneo:ws:*:broadcast",
      "kaneo:ws:project:broadcast",
      JSON.stringify({
        projectId: "project",
        authorizationBatch,
        message: { ...update, taskId },
      }),
    );
  receive("before-removal", "old-event");
  receive("before-removal", "another-old-event");
  await vi.waitFor(() => expect(m.members).toHaveBeenCalledTimes(1));
  receive("after-removal", "private-event");
  await vi.waitFor(() => expect(m.members).toHaveBeenCalledTimes(2));
  finish([{ userId: "user" }]);
  await vi.waitFor(() => expect(connection.close).toHaveBeenCalled());
  expect(
    connection.send.mock.calls.some(
      ([value]) => JSON.parse(value).taskId === "private-event",
    ),
  ).toBe(false);
});

it("still revokes local subscriptions when the post-removal role lookup fails", async () => {
  await initializeWebSocketAdapter();
  const ws = connect();
  m.admins.mockRejectedValueOnce(new Error("database unavailable"));
  await expect(
    revokeWorkspaceConnections("user", "old"),
  ).resolves.toBeUndefined();
  expect(ws.close).toHaveBeenCalledWith(1008, "Workspace access revoked");
});

it("retries revocation delivery after Redis recovers without a project broadcast", async () => {
  vi.useFakeTimers();
  m.redis = true;
  await initializeWebSocketAdapter();
  m.publish.mockRejectedValueOnce(new Error("Redis unavailable"));
  await revokeWorkspaceConnections("user", "old", { force: true });
  expect(m.publish).toHaveBeenCalledTimes(1);
  await vi.advanceTimersByTimeAsync(1_000);
  expect(m.publish).toHaveBeenCalledTimes(2);
  expect(JSON.parse(m.publish.mock.calls[1][1])).toMatchObject({
    userId: "user",
    message: { type: "WORKSPACE_ACCESS_REVOKED", workspaceId: "old" },
  });
  await vi.advanceTimersByTimeAsync(60_000);
  expect(m.publish).toHaveBeenCalledTimes(2);
});

it("drops a queued membership revocation when access is restored before Redis recovery", async () => {
  vi.useFakeTimers();
  m.redis = true;
  await initializeWebSocketAdapter();
  m.publish.mockRejectedValueOnce(new Error("Redis unavailable"));
  await revokeWorkspaceConnections("user", "old", { role: "user" });
  const reconnected = connect();
  m.members.mockResolvedValue([{ userId: "user" }]);
  await vi.advanceTimersByTimeAsync(60_000);
  expect(m.publish).toHaveBeenCalledTimes(1);
  expect(reconnected.close).not.toHaveBeenCalled();
});

it("retries a membership revocation while access remains absent", async () => {
  vi.useFakeTimers();
  m.redis = true;
  await initializeWebSocketAdapter();
  m.members.mockResolvedValue([]);
  m.publish.mockRejectedValueOnce(new Error("Redis unavailable"));
  await revokeWorkspaceConnections("user", "old", { role: "user" });
  await vi.advanceTimersByTimeAsync(1_000);
  expect(m.publish).toHaveBeenCalledTimes(2);
});

it("returns after local revocation while Redis PUBLISH remains queued", async () => {
  vi.useFakeTimers();
  m.redis = true;
  await initializeWebSocketAdapter();
  const ws = connect();
  let finish!: (value: number) => void;
  m.publish.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  await expect(
    revokeWorkspaceConnections("user", "old", { force: true }),
  ).resolves.toBeUndefined();
  expect(ws.close).toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(60_000);
  expect(m.publish).toHaveBeenCalledTimes(1);
  finish(1);
  await vi.advanceTimersByTimeAsync(60_000);
  expect(m.publish).toHaveBeenCalledTimes(1);
});
it("revokes every project subscription for a deleted user regardless of membership", async () => {
  const first = connect();
  const second = connect("other", "implicit-admin-workspace");
  await revokeUserConnections("user");
  expect(first.close).toHaveBeenCalledWith(1008, "User access revoked");
  expect(second.close).toHaveBeenCalledWith(1008, "User access revoked");
});
it("revokes all remote subscriptions on a deleted-user Redis message", async () => {
  m.redis = true;
  await initializeWebSocketAdapter();
  const ws = connect("other", "implicit-admin-workspace");
  const handler = m.on.mock.calls[1][1];
  handler(
    "kaneo:ws-user:*:broadcast",
    "kaneo:ws-user:user:broadcast",
    JSON.stringify({
      userId: "user",
      message: { type: "USER_ACCESS_REVOKED" },
    }),
  );
  expect(ws.close).toHaveBeenCalledWith(1008, "User access revoked");
});
