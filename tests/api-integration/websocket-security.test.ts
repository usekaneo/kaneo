import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import db, { schema } from "../../apps/api/src/database";
import { once } from "node:events";
import type { IncomingMessage } from "node:http";
import { createRequire } from "node:module";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import { serve } from "../../apps/api/node_modules/@hono/node-server";
import type { NodeWebSocket } from "../../apps/api/node_modules/@hono/node-ws";
import { auth } from "../../apps/api/src/auth";
import { createApp } from "../../apps/api/src/index";
import {
  broadcastToProject,
  broadcastToUser,
  initializeWebSocketAdapter,
  shutdownWebSocketAdapter,
} from "../../apps/api/src/ws";
import { handleWebSocketMessage } from "../../apps/api/src/ws/security";
import { mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";

// Use the actual client from node-ws's installed dependency, without adding a
// production dependency or connecting to any remote server.
type Socket = NodeWebSocket["wss"]["clients"] extends Set<infer S> ? S : never;
const apiRequire = createRequire(
  new URL("../../apps/api/package.json", import.meta.url),
);
const nodeWsRequire = createRequire(apiRequire.resolve("@hono/node-ws"));
const WebSocket: new (
  url: string,
  options: { headers: Record<string, string> },
) => Socket = nodeWsRequire("ws").WebSocket;

vi.mock("../../apps/api/src/ws/security", async (original) => {
  const actual =
    await original<typeof import("../../apps/api/src/ws/security")>();
  return {
    ...actual,
    handleWebSocketMessage: vi.fn(actual.handleWebSocketMessage),
  };
});

let server: ReturnType<typeof serve>;
let baseUrl: string;
let userId: string;
let projectId: string;
let workspaceId: string;
const sockets: Socket[] = [];
async function connect(path: string, headers: Record<string, string>) {
  const socket = new WebSocket(`${baseUrl}/api/ws/${path}`, { headers });
  sockets.push(socket);
  socket.on("error", () => {});
  const status = await new Promise<number>((resolve) => {
    socket.once("open", () => resolve(101));
    socket.once(
      "unexpected-response",
      (_request: unknown, response: IncomingMessage) => {
        response.resume();
        resolve(response.statusCode ?? 0);
        socket.terminate();
      },
    );
  });
  return { socket, status };
}

beforeEach(async () => {
  await resetTestDatabase();
  vi.clearAllMocks();
  vi.stubEnv("CORS_ORIGINS", "https://extra.example.test");
  const member = await createWorkspaceMember();
  userId = member.user.id;
  workspaceId = member.workspace.id;
  const { project } = await createProjectFixture({
    workspaceId: member.workspace.id,
  });
  projectId = project.id;
  const sessionMock = mockAuthenticatedSession(member.user);
  const session = await auth.api.getSession({ headers: new Headers() });
  sessionMock.mockImplementation(async ({ headers }) => {
    const h = new Headers(headers);
    return h.get("authorization") === "Bearer valid-test-session" ||
      h.get("cookie") === "test-session=valid"
      ? session
      : null;
  });
  const created = createApp();
  server = serve({ fetch: created.app.fetch, hostname: "127.0.0.1", port: 0 });
  created.injectWebSocket(server);
  if (!server.listening) await once(server, "listening");
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("No test port");
  baseUrl = `ws://127.0.0.1:${address.port}`;
});

afterEach(async () => {
  await shutdownWebSocketAdapter();
  for (const socket of sockets.splice(0)) socket.terminate();
  if (server)
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  vi.unstubAllEnvs();
});

describe.each(["project", "user"])("%s WebSocket", (endpoint) => {
  const path = () => (endpoint === "user" ? "user" : projectId);
  it("consumes a single quota and rate-limit unit per API-key handshake", async () => {
    const key = `ws-key-${userId}`;
    const [row] = await db
      .insert(schema.apikeyTable)
      .values({
        referenceId: userId,
        userId,
        key: createHash("sha256").update(key).digest("base64url"),
        remaining: 1,
        rateLimitEnabled: true,
        rateLimitMax: 1,
        rateLimitTimeWindow: 60_000,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();
    expect((await connect(path(), { "x-api-key": key })).status).toBe(101);
    const [saved] = await db
      .select()
      .from(schema.apikeyTable)
      .where(eq(schema.apikeyTable.id, row.id));
    expect(saved.remaining).toBe(0);
    expect(saved.requestCount).toBe(1);
    expect((await connect(path(), { "x-api-key": key })).status).toBe(429);
  });
  it("rejects missing, null, hostile and lookalike browser origins", async () => {
    for (const origin of [
      undefined,
      "null",
      "https://evil.example.test",
      "http://localhost:5173.evil.test",
      "http://localhost:5173/",
      "http://localhost:5174",
    ]) {
      const { status } = await connect(path(), {
        cookie: "test-session=valid",
        ...(origin === undefined ? {} : { origin }),
      });
      expect(status, String(origin)).toBe(403);
    }
  });
  it("allows configured origins and explicit native sessions, retaining authentication", async () => {
    for (const origin of [
      "http://localhost:5173",
      "http://localhost:1337",
      "https://extra.example.test",
    ]) {
      expect(
        (await connect(path(), { cookie: "test-session=valid", origin }))
          .status,
      ).toBe(101);
    }
    expect(
      (await connect(path(), { authorization: "Bearer valid-test-session" }))
        .status,
    ).toBe(101);
    expect(
      (
        await connect(path(), {
          authorization: "Bearer invalid",
          cookie: "test-session=valid",
        })
      ).status,
    ).toBe(401);
    expect(
      (await connect(path(), { origin: "http://localhost:5173" })).status,
    ).toBe(401);
  });
  it.each(["text", "binary", "fragmented"])(
    "rejects oversized %s messages before application delivery",
    async (kind) => {
      const { socket, status } = await connect(path(), {
        cookie: "test-session=valid",
        origin: "http://localhost:5173",
      });
      expect(status).toBe(101);
      const closed = once(socket, "close");
      if (kind === "fragmented") {
        socket.send("a".repeat(40), { fin: false });
        socket.send("b".repeat(40), { fin: true });
      } else {
        socket.send(kind === "binary" ? Buffer.alloc(65) : "a".repeat(65));
      }
      expect((await closed)[0]).toBe(1009);
      expect(handleWebSocketMessage).not.toHaveBeenCalled();
    },
  );
  it.each([
    ["unsupported JSON", '{"type":"other"}', 1008],
    ["malformed JSON", "{", 1008],
    ["binary ping", Buffer.from('{"type":"ping"}'), 1003],
  ] as const)(
    "closes %s and keeps valid pings working",
    async (_name, payload, code) => {
      const { socket, status } = await connect(path(), {
        cookie: "test-session=valid",
        origin: "http://localhost:5173",
      });
      expect(status).toBe(101);
      socket.send('{"type":"ping"}');
      const pong = once(socket, "pong");
      socket.ping("test");
      await pong;
      expect(socket.readyState).toBe(1);
      const closed = once(socket, "close");
      socket.send(payload);
      expect((await closed)[0]).toBe(code);
    },
  );
});

it("preserves user event delivery after keepalive", async () => {
  const { socket, status } = await connect("user", {
    cookie: "test-session=valid",
    origin: "http://localhost:5173",
  });
  expect(status).toBe(101);
  socket.send('{"type":"ping"}');
  const message = once(socket, "message");
  broadcastToUser(userId, {
    type: "NOTIFICATION_CREATED",
    notificationId: "local-only",
  });
  expect(JSON.parse((await message)[0].toString())).toEqual({
    type: "NOTIFICATION_CREATED",
    notificationId: "local-only",
  });
});

it("still rejects access to a foreign project with a valid Origin", async () => {
  const foreign = await createWorkspaceMember();
  const { project } = await createProjectFixture({
    workspaceId: foreign.workspace.id,
  });
  const headers = {
    cookie: "test-session=valid",
    origin: "http://localhost:5173",
  };
  expect((await connect(project.id, headers)).status).toBe(404);
  expect((await connect("missing-project", headers)).status).toBe(404);
});

async function createScopedKey(permissions: Record<string, string[]>) {
  const key = `scoped-ws-${userId}`;
  const [row] = await db
    .insert(schema.apikeyTable)
    .values({
      referenceId: userId,
      userId,
      key: createHash("sha256").update(key).digest("base64url"),
      permissions: JSON.stringify(permissions),
      enabled: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning();
  return { key, id: row.id };
}

describe("project WebSocket read authorization", () => {
  for (const authentication of ["api-key", "custom-role"] as const) {
    it.each([
      [{ label: ["read"] }, 403],
      [{ project: ["read"] }, 403],
      [{ task: ["read"] }, 403],
      [{ project: ["read"], task: ["read"] }, 101],
    ] as [Record<string, string[]>, number][])(
      `${authentication} enforces read grants %j at upgrade`,
      async (permissions, expected) => {
        let headers: Record<string, string>;
        if (authentication === "api-key") {
          const { key } = await createScopedKey(permissions);
          headers = { "x-api-key": key };
        } else {
          await db
            .update(schema.workspaceUserTable)
            .set({ role: "limited" })
            .where(eq(schema.workspaceUserTable.userId, userId));
          await db.insert(schema.workspaceRoleTable).values({
            workspaceId,
            role: "limited",
            permission: JSON.stringify(permissions),
          });
          headers = { authorization: "Bearer valid-test-session" };
        }
        expect((await connect(projectId, headers)).status).toBe(expected);
      },
    );
  }

  it.each(["scope", "disabled", "expired", "deleted"])(
    "stops delivery after an API key is %s without revoking the owner's cookie connection",
    async (change) => {
      await initializeWebSocketAdapter();
      const { key, id } = await createScopedKey({
        project: ["read"],
        task: ["read"],
      });
      const keyed = await connect(projectId, { "x-api-key": key });
      const browser = await connect(projectId, {
        cookie: "test-session=valid",
        origin: "http://localhost:5173",
      });
      expect(keyed.status).toBe(101);
      expect(browser.status).toBe(101);
      const leaked = vi.fn();
      keyed.socket.on("message", leaked);
      if (change === "deleted") {
        await db
          .delete(schema.apikeyTable)
          .where(eq(schema.apikeyTable.id, id));
      } else {
        await db
          .update(schema.apikeyTable)
          .set(
            change === "scope"
              ? { permissions: JSON.stringify({ label: ["read"] }) }
              : change === "disabled"
                ? { enabled: false }
                : { expiresAt: new Date(Date.now() - 60_000) },
          )
          .where(eq(schema.apikeyTable.id, id));
      }
      const closed = once(keyed.socket, "close");
      const received = once(browser.socket, "message");
      const update = {
        type: "TASK_UPDATED",
        projectId,
        taskId: "private-task",
      };
      broadcastToProject(projectId, update);
      expect((await closed)[0]).toBe(1008);
      expect(leaked).not.toHaveBeenCalled();
      expect(JSON.parse((await received)[0].toString())).toEqual(update);
    },
  );

  it("stops delivery after a role's read grants are removed", async () => {
    await initializeWebSocketAdapter();
    await db.insert(schema.workspaceRoleTable).values({
      workspaceId,
      role: "member",
      permission: JSON.stringify({ project: ["read"], task: ["read"] }),
    });
    const { socket, status } = await connect(projectId, {
      authorization: "Bearer valid-test-session",
    });
    expect(status).toBe(101);
    const leaked = vi.fn();
    socket.on("message", leaked);
    await db
      .update(schema.workspaceRoleTable)
      .set({ permission: "{}" })
      .where(eq(schema.workspaceRoleTable.workspaceId, workspaceId));
    const closed = once(socket, "close");
    broadcastToProject(projectId, {
      type: "TASK_UPDATED",
      projectId,
      taskId: "private-task",
    });
    expect((await closed)[0]).toBe(1008);
    expect(leaked).not.toHaveBeenCalled();
  });
});
