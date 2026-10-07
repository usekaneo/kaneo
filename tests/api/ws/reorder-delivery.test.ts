import type { WSContext } from "hono/ws";
import { afterEach, expect, it, vi } from "vite-plus/test";
import { publishEvent } from "../../../apps/api/src/events";
import {
  addConnection,
  initializeWebSocketAdapter,
  removeConnection,
  shutdownWebSocketAdapter,
} from "../../../apps/api/src/ws";
vi.mock(
  "../../../apps/api/src/project-access/filter-users-with-project-access",
  () => ({
    filterUsersWithProjectAccess: async (userIds: Iterable<string>) =>
      new Set(userIds),
  }),
);
vi.mock("../../../apps/api/src/database", () => ({
  default: {
    select: (fields: Record<string, unknown>) => ({
      from: () => ({
        where: () =>
          fields.userId
            ? Promise.resolve([{ userId: "observer" }])
            : { limit: async () => [{ workspaceId: "workspace" }] },
      }),
    }),
  },
}));
vi.mock("../../../apps/api/src/redis", () => ({
  isRedisConfigured: () => false,
  closeRedis: vi.fn(),
}));
afterEach(async () => {
  await shutdownWebSocketAdapter();
  vi.useRealTimers();
});
it.each([1, 2])(
  "delivers %i committed reorder batch through the real subscriber and local adapter",
  async (batches) => {
    vi.useFakeTimers();
    await initializeWebSocketAdapter();
    const ws = { send: vi.fn(), close: vi.fn() };
    const connection = addConnection(
      "project",
      ws as unknown as WSContext,
      "observer",
      "window",
      "workspace",
    );
    const tasks = [
      { id: "one", position: 1, status: "to-do" },
      { id: "two", position: 0, status: "to-do" },
    ];
    try {
      for (let index = 0; index < batches; index++)
        await publishEvent(
          "tasks.reordered",
          { projectId: "project", userId: "actor", tasks },
          { waitForHandlers: true },
        );
      await vi.advanceTimersByTimeAsync(100);
      expect(ws.send).toHaveBeenCalledTimes(batches);
      expect(JSON.parse(ws.send.mock.calls[0][0])).toEqual({
        type: "TASKS_REORDERED",
        projectId: "project",
        tasks,
      });
    } finally {
      removeConnection("project", connection);
    }
  },
);
