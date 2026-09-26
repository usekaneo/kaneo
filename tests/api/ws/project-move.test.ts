import type { WSContext } from "hono/ws";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  addConnection,
  broadcastToProject,
  closeProjectConnections,
  initializeWebSocketAdapter,
  removeConnection,
  shutdownWebSocketAdapter,
} from "../../../apps/api/src/ws";

const m = vi.hoisted(() => ({
  lookup: vi.fn(),
  redis: false,
  publish: vi.fn(),
  on: vi.fn(),
}));
vi.mock("../../../apps/api/src/database", () => ({
  default: {
    select: () => ({ from: () => ({ where: () => ({ limit: m.lookup }) }) }),
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
  it("fails closed when workspace lookup fails", async () => {
    vi.useFakeTimers();
    await initializeWebSocketAdapter();
    const old = connect();
    m.lookup.mockRejectedValueOnce(new Error("Database unavailable"));
    broadcastToProject("project", update);
    await vi.advanceTimersByTimeAsync(100);
    expect(old.send).not.toHaveBeenCalled();
    expect(old.close).toHaveBeenCalled();
  });
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
