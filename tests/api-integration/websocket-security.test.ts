import { once } from "node:events";
import type { IncomingMessage } from "node:http";
import { createRequire } from "node:module";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { serve } from "../../apps/api/node_modules/@hono/node-server";
import type { NodeWebSocket } from "../../apps/api/node_modules/@hono/node-ws";
import { auth } from "../../apps/api/src/auth";
import { createApp } from "../../apps/api/src/index";
import { broadcastToUser } from "../../apps/api/src/ws";
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
  for (const socket of sockets.splice(0)) socket.terminate();
  if (server)
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  vi.unstubAllEnvs();
});

describe.each(["project", "user"])("%s WebSocket", (endpoint) => {
  const path = () => (endpoint === "user" ? "user" : projectId);
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
  expect(
    (
      await connect(project.id, {
        cookie: "test-session=valid",
        origin: "http://localhost:5173",
      })
    ).status,
  ).toBe(403);
});
