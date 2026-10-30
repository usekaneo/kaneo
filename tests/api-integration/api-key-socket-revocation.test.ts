import { once } from "node:events";
import { createRequire } from "node:module";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import { serve } from "../../apps/api/node_modules/@hono/node-server";
import type { NodeWebSocket } from "../../apps/api/node_modules/@hono/node-ws";
import { auth } from "../../apps/api/src/auth";
import { createApp } from "../../apps/api/src/index";
import { shutdownWebSocketAdapter } from "../../apps/api/src/ws";
import { signUpWithSession } from "./helpers/auth-session";
import { resetTestDatabase } from "./helpers/database";

type Socket = NodeWebSocket["wss"]["clients"] extends Set<infer S> ? S : never;
const apiRequire = createRequire(
  new URL("../../apps/api/package.json", import.meta.url),
);
const nodeWsRequire = createRequire(apiRequire.resolve("@hono/node-ws"));
const WebSocket: new (
  url: string,
  options: { headers: Record<string, string> },
) => Socket = nodeWsRequire("ws").WebSocket;

const ORIGIN = "http://localhost:5173";
type App = ReturnType<typeof createApp>["app"];
type Account = { userId: string; cookies: string };

let app: App;
let server: ReturnType<typeof serve>;
let baseUrl: string;
let admin: Account;
let target: Account;
const sockets: Socket[] = [];

async function connectUserSocket(headers: Record<string, string>) {
  const socket = new WebSocket(`${baseUrl}/api/ws/user`, { headers });
  sockets.push(socket);
  socket.on("error", () => {});
  await once(socket, "open");
  return socket;
}

function closeOf(socket: Socket) {
  return once(socket, "close").then(([code, reason]) => ({
    code,
    reason: String(reason),
  }));
}

/** A ping round trip proves the socket is still open after the revocation. */
async function isOpen(socket: Socket) {
  const pong = once(socket, "pong");
  socket.ping();
  await pong;
  return socket.readyState === 1;
}

beforeEach(async () => {
  await resetTestDatabase();
  const created = createApp();
  app = created.app;
  server = serve({ fetch: app.fetch, hostname: "127.0.0.1", port: 0 });
  created.injectWebSocket(server);
  if (!server.listening) await once(server, "listening");
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("No test port");
  baseUrl = `ws://127.0.0.1:${address.port}`;
  admin = await signUpWithSession(app, {
    email: "admin@example.com",
    name: "Ada Admin",
    role: "admin",
  });
  target = await signUpWithSession(app, {
    email: "target@example.com",
    name: "Tom Target",
    role: "user",
  });
});

afterEach(async () => {
  await shutdownWebSocketAdapter();
  for (const socket of sockets.splice(0)) socket.terminate();
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
});

describe("API integration: user sockets of revoked API keys", () => {
  async function connectTargetSockets() {
    const revoked = await auth.api.createApiKey({
      body: { userId: target.userId, name: "CI deploys" },
    });
    const kept = await auth.api.createApiKey({
      body: { userId: target.userId, name: "Laptop" },
    });
    return {
      revoked,
      revokedSocket: await connectUserSocket({ "x-api-key": revoked.key }),
      keptSocket: await connectUserSocket({ "x-api-key": kept.key }),
      sessionSocket: await connectUserSocket({
        cookie: target.cookies,
        origin: ORIGIN,
      }),
    };
  }

  it("closes the key's sockets when an admin revokes it, and only those", async () => {
    const { revoked, revokedSocket, keptSocket, sessionSocket } =
      await connectTargetSockets();
    const closed = closeOf(revokedSocket);

    const response = await app.request(
      `/api/admin/users/${target.userId}/api-keys/${revoked.id}`,
      { method: "DELETE", headers: { cookie: admin.cookies, origin: ORIGIN } },
    );

    expect(response.status).toBe(200);
    expect(await closed).toEqual({ code: 1008, reason: "API key revoked" });
    expect(await isOpen(keptSocket)).toBe(true);
    expect(await isOpen(sessionSocket)).toBe(true);
  });

  it("closes the key's sockets when its owner deletes it", async () => {
    const { revoked, revokedSocket, keptSocket, sessionSocket } =
      await connectTargetSockets();
    const closed = closeOf(revokedSocket);

    const response = await app.request("/api/auth/api-key/delete", {
      method: "POST",
      headers: {
        cookie: target.cookies,
        origin: ORIGIN,
        "content-type": "application/json",
      },
      body: JSON.stringify({ keyId: revoked.id }),
    });

    expect(response.status).toBe(200);
    expect(await closed).toEqual({ code: 1008, reason: "API key revoked" });
    expect(await isOpen(keptSocket)).toBe(true);
    expect(await isOpen(sessionSocket)).toBe(true);
  });
});
