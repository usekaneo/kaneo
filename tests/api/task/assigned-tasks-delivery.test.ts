import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

const { state } = vi.hoisted(() => ({
  state: {
    lookups: [] as string[],
    assigneeByTask: {} as Record<string, string | null>,
  },
}));

// Only the database is mocked: events go through the real in-process bus and
// the broadcast through the real in-memory adapter, so the test covers the
// whole path from `publishEvent` to the assignee's socket.
vi.mock("../../../apps/api/src/database", async () => {
  const schema = await import("../../../apps/api/src/database/schema");
  const { PgDialect } = await import("drizzle-orm/pg-core");
  const dialect = new PgDialect();
  let boundId: string | undefined;

  const chain = {
    select: () => chain,
    from: () => chain,
    where: (condition: Parameters<typeof dialect.sqlToQuery>[0]) => {
      const [id] = dialect.sqlToQuery(condition).params;
      boundId = typeof id === "string" ? id : undefined;
      return chain;
    },
    limit: async () => {
      if (!boundId) return [];
      state.lookups.push(boundId);
      return boundId in state.assigneeByTask
        ? [{ userId: state.assigneeByTask[boundId] }]
        : [];
    },
  };

  return { default: chain, schema };
});

import { publishEvent } from "../../../apps/api/src/events";
import { registerAssignedTasksRealtime } from "../../../apps/api/src/task/assigned-tasks-realtime";
import {
  addUserConnection,
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

function sentMessages(ws: unknown) {
  const send = (ws as { send: ReturnType<typeof vi.fn> }).send;
  return send.mock.calls.map(([payload]) => JSON.parse(payload as string));
}

describe("assigned tasks realtime delivery", () => {
  const originalRedisUrl = process.env.REDIS_URL;
  const cleanups: Array<() => void> = [];

  function connect(userId: string) {
    const ws = makeFakeWs();
    const conn = addUserConnection(userId, ws);
    cleanups.push(() => removeUserConnection(userId, conn));
    return ws;
  }

  beforeAll(() => {
    registerAssignedTasksRealtime();
  });

  beforeEach(async () => {
    delete process.env.REDIS_URL;
    await initializeWebSocketAdapter();
    state.lookups = [];
    state.assigneeByTask = { "task-1": "user-assignee" };
  });

  afterEach(async () => {
    for (const cleanup of cleanups.splice(0)) cleanup();
    await shutdownWebSocketAdapter();
    if (originalRedisUrl === undefined) {
      delete process.env.REDIS_URL;
    } else {
      process.env.REDIS_URL = originalRedisUrl;
    }
  });

  it("pushes a task change to the assignee's socket and to nobody else", async () => {
    const assignee = connect("user-assignee");
    const actor = connect("user-actor");
    const bystander = connect("user-bystander");

    await publishEvent("task.priority_changed", {
      taskId: "task-1",
      projectId: "project-1",
      userId: "user-actor",
    });

    await vi.waitFor(() => expect(sentMessages(assignee)).toHaveLength(1), {
      timeout: 300,
    });

    expect(sentMessages(assignee)[0]).toEqual({
      type: "ASSIGNED_TASKS_UPDATED",
      taskId: "task-1",
      projectId: "project-1",
      event: "task.priority_changed",
    });
    expect(sentMessages(actor)).toEqual([]);
    expect(sentMessages(bystander)).toEqual([]);
  });

  it("reaches both sides of a reassignment", async () => {
    const previous = connect("user-old");
    const next = connect("user-new");

    await publishEvent("task.assignee_changed", {
      taskId: "task-1",
      projectId: "project-1",
      userId: "user-actor",
      oldAssignee: "user-old",
      newAssigneeId: "user-new",
    });

    await vi.waitFor(
      () => {
        expect(sentMessages(previous)).toHaveLength(1);
        expect(sentMessages(next)).toHaveLength(1);
      },
      { timeout: 300 },
    );

    expect(sentMessages(next)[0].event).toBe("task.assignee_changed");
    expect(state.lookups).toEqual([]);
  });

  it("reaches the assignee of a deleted task from the event payload", async () => {
    const assignee = connect("user-old");

    await publishEvent("task.deleted", {
      taskId: "task-gone",
      projectId: "project-1",
      userId: "user-actor",
      assigneeId: "user-old",
    });

    await vi.waitFor(() => expect(sentMessages(assignee)).toHaveLength(1), {
      timeout: 300,
    });

    expect(sentMessages(assignee)[0]).toMatchObject({
      type: "ASSIGNED_TASKS_UPDATED",
      taskId: "task-gone",
      event: "task.deleted",
    });
    expect(state.lookups).toEqual([]);
  });

  it("stays silent when the task has no assignee", async () => {
    state.assigneeByTask = { "task-1": null };
    const actor = connect("user-actor");

    await publishEvent("task.due_date_changed", {
      taskId: "task-1",
      projectId: "project-1",
      userId: "user-actor",
    });

    await vi.waitFor(() => expect(state.lookups).toEqual(["task-1"]), {
      timeout: 300,
    });
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(sentMessages(actor)).toEqual([]);
  });
});
