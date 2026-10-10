import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";

const { handlers } = vi.hoisted(() => ({
  handlers: new Map<string, (data: unknown) => Promise<void>>(),
}));

vi.mock("../../../apps/api/src/events", () => ({
  subscribeToEvent: vi.fn(
    async (name: string, handler: (data: unknown) => Promise<void>) => {
      handlers.set(name, handler);
    },
  ),
  publishEvent: vi.fn(),
}));
vi.mock("../../../apps/api/src/ws/list-workspace-member-ids", () => ({
  listWorkspaceMemberIds: vi.fn(async (workspaceId: string) =>
    workspaceId === "workspace-1" ? ["member-1", "member-2"] : [],
  ),
}));

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

function sent(ws: unknown) {
  return (ws as { send: ReturnType<typeof vi.fn> }).send.mock.calls.map(
    ([message]) => JSON.parse(message as string),
  );
}

describe("workspace_plugin.updated", () => {
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

  it("tells every member of the workspace and nobody else", async () => {
    const member = makeFakeWs();
    const otherMember = makeFakeWs();
    const outsider = makeFakeWs();
    const connections = [
      ["member-1", addUserConnection("member-1", member)],
      ["member-2", addUserConnection("member-2", otherMember)],
      ["outsider", addUserConnection("outsider", outsider)],
    ] as const;

    await handlers.get("workspace_plugin.updated")?.({
      workspaceId: "workspace-1",
      pluginId: "progress",
      enabled: false,
      initiatorId: "member-1",
    });

    const expected = {
      type: "WORKSPACE_PLUGIN_UPDATED",
      workspaceId: "workspace-1",
      pluginId: "progress",
      enabled: false,
    };
    await vi.waitFor(
      () => {
        expect(sent(member)).toEqual([expected]);
        expect(sent(otherMember)).toEqual([expected]);
      },
      { timeout: 300 },
    );
    expect(sent(outsider)).toEqual([]);

    for (const [userId, connection] of connections) {
      removeUserConnection(userId, connection);
    }
  });
});
