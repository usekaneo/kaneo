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
import { subscribeToEvent } from "../../../apps/api/src/events";

const m = vi.hoisted(() => ({
  lookup: vi.fn(),
  members: vi.fn(),
  admins: vi.fn(),
  projectAccess: vi.fn(),
  inaccessible: vi.fn(),
  sync: vi.fn(),
  redis: false,
  publish: vi.fn(),
  on: vi.fn(),
}));
vi.mock(
  "../../../apps/api/src/ws/workspace-access",
  async (importOriginal) => ({
    ...(await importOriginal<
      typeof import("../../../apps/api/src/ws/workspace-access")
    >()),
    syncWorkspaceAccess: m.sync,
  }),
);
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
vi.mock(
  "../../../apps/api/src/project-access/filter-users-with-project-access",
  () => ({
    filterUsersWithProjectAccess: async () =>
      new Set(
        ((await m.projectAccess()) as { userId: string }[]).map(
          (row) => row.userId,
        ),
      ),
  }),
);
vi.mock("../../../apps/api/src/events", () => ({ subscribeToEvent: vi.fn() }));
vi.mock(
  "../../../apps/api/src/project-access/find-inaccessible-project-ids",
  () => ({
    findInaccessibleProjectIds: m.inaccessible,
  }),
);
vi.mock(
  "../../../apps/api/src/project-access/list-workspace-project-ids",
  () => ({ listWorkspaceProjectIds: async () => [] }),
);
const projectAccessUpdated = vi
  .mocked(subscribeToEvent)
  .mock.calls.find(([eventName]) => eventName === "project_access.updated")![1];
vi.mock("../../../apps/api/src/redis", () => ({
  isRedisConfigured: () => m.redis,
  getRedisPub: () => ({ publish: m.publish }),
  getRedisSub: () => ({
    on: m.on,
    off: vi.fn(),
    psubscribe: vi.fn(async () => {}),
    punsubscribe: vi.fn(),
  }),
  closeRedis: vi.fn(),
}));
const tracked: Array<[string, ReturnType<typeof addConnection>]> = [];
function connect(projectId = "project", workspaceId = "old", userId = "user") {
  const ws = { send: vi.fn(), close: vi.fn() };
  tracked.push([
    projectId,
    addConnection(
      projectId,
      ws as unknown as WSContext,
      userId,
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
  m.projectAccess.mockResolvedValue([{ userId: "user" }]);
  m.inaccessible.mockResolvedValue([]);
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
  it.each(["lookup", "members", "projectAccess"] as const)(
    "skips delivery without revoking access on transient %s failure",
    async (lookup) => {
      vi.useFakeTimers();
      await initializeWebSocketAdapter();
      const old = connect();
      m[lookup].mockRejectedValueOnce(new Error("Database unavailable"));
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

describe("project access revocation", () => {
  it("stops broadcasts to a member who lost project access even when the change was missed", async () => {
    vi.useFakeTimers();
    await initializeWebSocketAdapter();
    const ws = connect();
    m.projectAccess.mockResolvedValue([]);
    broadcastToProject("project", update);
    await vi.advanceTimersByTimeAsync(100);
    expect(ws.send).not.toHaveBeenCalled();
    expect(ws.close).toHaveBeenCalledWith(1008, "Project access revoked");
  });

  it("closes only the inaccessible project sockets and notifies every tab", async () => {
    await initializeWebSocketAdapter();
    const revoked = connect();
    const kept = connect("kept-project");
    const elsewhere = connect("other-project", "other-workspace");
    const tab = { send: vi.fn(), close: vi.fn() };
    const conn = addUserConnection("user", tab as unknown as WSContext);
    m.inaccessible.mockResolvedValue(["project"]);
    try {
      await projectAccessUpdated({ workspaceId: "old", userId: "user" });
      await vi.waitFor(() =>
        expect(revoked.close).toHaveBeenCalledWith(
          1008,
          "Project access revoked",
        ),
      );
      expect(m.inaccessible).toHaveBeenCalledWith("user", [
        "project",
        "kept-project",
      ]);
      expect(kept.close).not.toHaveBeenCalled();
      expect(elsewhere.close).not.toHaveBeenCalled();
      expect(tab.send).toHaveBeenCalledWith(
        JSON.stringify({ type: "PROJECT_ACCESS_CHANGED", workspaceId: "old" }),
      );
      expect(tab.close).not.toHaveBeenCalled();
    } finally {
      removeUserConnection("user", conn);
    }
  });

  it("keeps project sockets open when the access check fails", async () => {
    await initializeWebSocketAdapter();
    const ws = connect();
    m.inaccessible.mockRejectedValueOnce(new Error("database unavailable"));
    await projectAccessUpdated({ workspaceId: "old", userId: "user" });
    await vi.waitFor(() => expect(m.inaccessible).toHaveBeenCalled());
    await Promise.resolve();
    expect(ws.close).not.toHaveBeenCalled();
  });

  it("fans the change out to other instances through the user Redis channel", async () => {
    m.redis = true;
    await initializeWebSocketAdapter();
    await projectAccessUpdated({ workspaceId: "old", userId: "user" });
    expect(m.publish).toHaveBeenCalledWith(
      "kaneo:ws-user:user:broadcast",
      expect.any(String),
    );
    expect(JSON.parse(m.publish.mock.calls[0][1])).toMatchObject({
      userId: "user",
      message: { type: "PROJECT_ACCESS_CHANGED", workspaceId: "old" },
    });
  });

  it("revokes remote project sockets on a Redis project access change", async () => {
    m.redis = true;
    await initializeWebSocketAdapter();
    const ws = connect();
    m.inaccessible.mockResolvedValue(["project"]);
    const handler = m.on.mock.calls[1][1];
    handler(
      "kaneo:ws-user:*:broadcast",
      "kaneo:ws-user:user:broadcast",
      JSON.stringify({
        userId: "user",
        origin: "remote-instance",
        message: { type: "PROJECT_ACCESS_CHANGED", workspaceId: "old" },
      }),
    );
    await vi.waitFor(() =>
      expect(ws.close).toHaveBeenCalledWith(1008, "Project access revoked"),
    );
  });

  it("does not let a pending project access change replace a workspace revocation", async () => {
    vi.useFakeTimers();
    m.redis = true;
    await initializeWebSocketAdapter();
    m.publish.mockRejectedValueOnce(new Error("Redis unavailable"));
    m.publish.mockRejectedValueOnce(new Error("Redis unavailable"));
    await revokeWorkspaceConnections("user", "old", { force: true });
    await projectAccessUpdated({ workspaceId: "old", userId: "user" });
    await vi.advanceTimersByTimeAsync(1_000);
    const types = m.publish.mock.calls.map(
      ([, data]) => JSON.parse(data).message.type,
    );
    expect(
      types.filter((type) => type === "WORKSPACE_ACCESS_REVOKED"),
    ).toHaveLength(2);
    expect(
      types.filter((type) => type === "PROJECT_ACCESS_CHANGED"),
    ).toHaveLength(2);
  });

  it("rechecks local project sockets once per user after Redis reconnects", async () => {
    m.redis = true;
    await initializeWebSocketAdapter();
    const revoked = connect();
    const kept = connect("kept-project");
    const elsewhere = connect("other-project", "other-workspace");
    const colleague = connect("project", "old", "colleague");
    const tab = { send: vi.fn(), close: vi.fn() };
    const colleagueTab = { send: vi.fn(), close: vi.fn() };
    const conn = addUserConnection("user", tab as unknown as WSContext);
    const colleagueConn = addUserConnection(
      "colleague",
      colleagueTab as unknown as WSContext,
    );
    m.inaccessible.mockImplementation(async (userId: string) =>
      userId === "user" ? ["project"] : [],
    );
    try {
      const ready = m.on.mock.calls.find(([event]) => event === "ready")![1];
      ready();
      await vi.waitFor(() =>
        expect(revoked.close).toHaveBeenCalledWith(
          1008,
          "Project access revoked",
        ),
      );
      expect(m.inaccessible).toHaveBeenCalledTimes(2);
      expect(m.inaccessible).toHaveBeenCalledWith("user", [
        "project",
        "kept-project",
        "other-project",
      ]);
      expect(m.inaccessible).toHaveBeenCalledWith("colleague", ["project"]);
      expect(kept.close).not.toHaveBeenCalled();
      expect(elsewhere.close).not.toHaveBeenCalled();
      expect(colleague.close).not.toHaveBeenCalled();
      await vi.waitFor(() =>
        expect(tab.send).toHaveBeenCalledWith(
          JSON.stringify({
            type: "PROJECT_ACCESS_CHANGED",
            workspaceId: "old",
          }),
        ),
      );
      expect(tab.send).toHaveBeenCalledOnce();
      expect(tab.close).not.toHaveBeenCalled();
      expect(colleagueTab.send).not.toHaveBeenCalled();
      expect(m.sync).toHaveBeenCalledWith("user", tab);
      expect(m.sync).toHaveBeenCalledWith("colleague", colleagueTab);
    } finally {
      removeUserConnection("user", conn);
      removeUserConnection("colleague", colleagueConn);
    }
  });

  it("keeps project sockets open when the reconnect recheck fails", async () => {
    m.redis = true;
    await initializeWebSocketAdapter();
    const ws = connect();
    const tab = { send: vi.fn(), close: vi.fn() };
    const conn = addUserConnection("user", tab as unknown as WSContext);
    m.inaccessible.mockRejectedValueOnce(new Error("database unavailable"));
    try {
      const ready = m.on.mock.calls.find(([event]) => event === "ready")![1];
      ready();
      await vi.waitFor(() => expect(m.inaccessible).toHaveBeenCalledOnce());
      await vi.waitFor(() => expect(m.sync).toHaveBeenCalled());
      await Promise.resolve();
      expect(ws.close).not.toHaveBeenCalled();
      expect(tab.send).not.toHaveBeenCalled();
    } finally {
      removeUserConnection("user", conn);
    }
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
  expect(m.projectAccess).toHaveBeenCalledTimes(1);
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
