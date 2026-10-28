import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import { auth } from "../../apps/api/src/auth";
import db, { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import { SESSION_ENDED_CLOSE_CODE } from "../../apps/api/src/ws";
import { readAuditLog } from "./helpers/admin/read-audit-log";
import { signIn, signUpWithSession } from "./helpers/auth-session";
import { resetTestDatabase } from "./helpers/database";
import {
  connectSocket,
  disconnectSockets,
  FIREFOX_ON_LINUX,
  meStatus,
  sessionIdOf,
  sessionIdsOf,
  sessionTokens,
} from "./helpers/sessions/session-fixtures";

type App = ReturnType<typeof createApp>["app"];
type Account = { userId: string; cookies: string };

let app: App;
let admin: Account;
let target: Account;
let targetLaptop: string;

function call(
  method: "GET" | "DELETE",
  path: string,
  headers: Record<string, string>,
) {
  return app.request(`/api/admin/users/${path}`, {
    method,
    headers: {
      origin: "http://localhost:5173",
      "user-agent": "admin-session-test",
      ...headers,
    },
  });
}

const asAdmin = (method: "GET" | "DELETE", path: string) =>
  call(method, path, { cookie: admin.cookies });

async function createKey(userId: string, name: string) {
  return auth.api.createApiKey({ body: { userId, name } });
}

const keyStatus = (key: string) =>
  app
    .request("/api/user/me", { headers: { "x-api-key": key } })
    .then((response) => response.status);

beforeEach(async () => {
  await resetTestDatabase();
  ({ app } = createApp());
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
  targetLaptop = await signIn(app, "target@example.com", {
    "user-agent": FIREFOX_ON_LINUX,
  });
});

afterEach(() => disconnectSockets());

describe("API integration: admin access to sessions and API keys", () => {
  it("rejects non-admins, API keys, and anonymous callers on every route", async () => {
    const laptopId = await sessionIdOf(targetLaptop);
    const { id: keyId, key: targetKey } = await createKey(
      target.userId,
      "Target key",
    );
    const { key: adminKey } = await createKey(admin.userId, "Admin key");
    const routes: Array<["GET" | "DELETE", string]> = [
      ["GET", `${target.userId}/sessions`],
      ["DELETE", `${target.userId}/sessions/${laptopId}`],
      ["DELETE", `${target.userId}/sessions`],
      ["GET", `${target.userId}/api-keys`],
      ["DELETE", `${target.userId}/api-keys/${keyId}`],
    ];

    for (const [method, path] of routes) {
      expect(
        (await call(method, path, { cookie: target.cookies })).status,
        path,
      ).toBe(403);
      expect(
        (await call(method, path, { "x-api-key": adminKey })).status,
        path,
      ).toBe(403);
      expect((await call(method, path, {})).status, path).toBe(401);
    }
    expect(await meStatus(app, targetLaptop)).toBe(200);
    expect(await keyStatus(targetKey)).toBe(200);
    expect(await readAuditLog()).toEqual([]);
  });

  it("lists a user's sessions without tokens", async () => {
    const response = await asAdmin("GET", `${target.userId}/sessions`);

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    const { sessions } = (await response.json()) as {
      sessions: Array<Record<string, unknown>>;
    };
    expect(sessions.map((session) => session.id).sort()).toEqual(
      await sessionIdsOf(target.userId),
    );
    expect(sessions.every((session) => session.current === false)).toBe(true);
    expect(
      sessions.find((session) => session.browser === "Firefox"),
    ).toMatchObject({ os: "Linux" });
    const text = JSON.stringify(sessions);
    for (const token of await sessionTokens())
      expect(text).not.toContain(token);
  });

  it("signs out one session at once and audits it once, without the token", async () => {
    const laptopId = await sessionIdOf(targetLaptop);
    const tokensBeforeRevocation = await sessionTokens();
    const laptopSocket = connectSocket(target.userId, laptopId);
    const otherSocket = connectSocket(
      target.userId,
      await sessionIdOf(target.cookies),
    );

    const response = await asAdmin(
      "DELETE",
      `${target.userId}/sessions/${laptopId}`,
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ revoked: 1 });
    expect(await meStatus(app, targetLaptop)).toBe(401);
    expect(await meStatus(app, target.cookies)).toBe(200);
    expect(laptopSocket.close).toHaveBeenCalledWith(
      SESSION_ENDED_CLOSE_CODE,
      "Session ended",
    );
    expect(otherSocket.close).not.toHaveBeenCalled();
    const rows = await readAuditLog();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      action: "session.revoked",
      actorUserId: admin.userId,
      targetType: "user",
      targetId: target.userId,
      targetLabel: "target@example.com",
      metadata: { sessionId: laptopId },
      userAgent: "admin-session-test",
    });
    const auditText = JSON.stringify(rows);
    for (const token of tokensBeforeRevocation)
      expect(auditText).not.toContain(token);
  });

  it("refuses the admin's current session and sessions of other users", async () => {
    const adminSessionId = await sessionIdOf(admin.cookies);
    const response = await asAdmin(
      "DELETE",
      `${target.userId}/sessions/${adminSessionId}`,
    );
    const laptopId = await sessionIdOf(targetLaptop);
    const unknownUser = await asAdmin(
      "DELETE",
      `missing-user/sessions/${laptopId}`,
    );

    expect(response.status).toBe(409);
    expect(unknownUser.status).toBe(404);
    const otherAdminSession = await signIn(app, "admin@example.com");
    const crossUser = await asAdmin(
      "DELETE",
      `${target.userId}/sessions/${await sessionIdOf(otherAdminSession)}`,
    );
    expect(crossUser.status).toBe(404);
    expect(await meStatus(app, otherAdminSession)).toBe(200);
    expect(await meStatus(app, targetLaptop)).toBe(200);
    expect(await readAuditLog()).toEqual([]);
  });

  it("signs out every session of a user and audits it once", async () => {
    const tokensBeforeRevocation = await sessionTokens();
    const sockets = await Promise.all(
      [target.cookies, targetLaptop].map(async (cookies) =>
        connectSocket(target.userId, await sessionIdOf(cookies)),
      ),
    );
    const { key } = await createKey(target.userId, "Kept key");

    const response = await asAdmin("DELETE", `${target.userId}/sessions`);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ revoked: 3 });
    expect(await sessionIdsOf(target.userId)).toEqual([]);
    expect(await meStatus(app, target.cookies)).toBe(401);
    expect(await meStatus(app, targetLaptop)).toBe(401);
    for (const socket of sockets)
      expect(socket.close).toHaveBeenCalledWith(
        SESSION_ENDED_CLOSE_CODE,
        "Session ended",
      );
    expect(await keyStatus(key)).toBe(200);
    const rows = await readAuditLog();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      action: "session.revoked_all",
      targetId: target.userId,
      metadata: { count: 3 },
    });
    for (const token of tokensBeforeRevocation)
      expect(JSON.stringify(rows)).not.toContain(token);

    const again = await asAdmin("DELETE", `${target.userId}/sessions`);
    expect(await again.json()).toEqual({ revoked: 0 });
    expect(await readAuditLog()).toHaveLength(1);
  });

  it("keeps the admin's own current session when they sign themselves out everywhere", async () => {
    const otherAdminSession = await signIn(app, "admin@example.com");

    const list = await asAdmin("GET", `${admin.userId}/sessions`);
    const { sessions } = (await list.json()) as {
      sessions: Array<{ id: string; current: boolean }>;
    };
    const response = await asAdmin("DELETE", `${admin.userId}/sessions`);

    expect(sessions[0]).toEqual(
      expect.objectContaining({
        id: await sessionIdOf(admin.cookies),
        current: true,
      }),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ revoked: 2 });
    expect(await meStatus(app, admin.cookies)).toBe(200);
    expect(await meStatus(app, otherAdminSession)).toBe(401);
  });

  it("lists API keys as metadata only", async () => {
    const created = await createKey(target.userId, "CI deploys");
    await createKey(admin.userId, "Admin key");
    const [stored] = await db
      .select({ key: schema.apikeyTable.key })
      .from(schema.apikeyTable)
      .where(eq(schema.apikeyTable.id, created.id));

    const response = await asAdmin("GET", `${target.userId}/api-keys`);

    expect(response.status).toBe(200);
    const { apiKeys } = (await response.json()) as {
      apiKeys: Array<Record<string, unknown>>;
    };
    expect(apiKeys).toHaveLength(1);
    expect(Object.keys(apiKeys[0] ?? {}).sort()).toEqual([
      "createdAt",
      "enabled",
      "expiresAt",
      "id",
      "lastUsedAt",
      "name",
      "start",
    ]);
    expect(apiKeys[0]).toMatchObject({
      id: created.id,
      name: "CI deploys",
      enabled: true,
      expiresAt: null,
      lastUsedAt: null,
    });
    const text = JSON.stringify(apiKeys);
    expect(text).not.toContain(created.key);
    expect(text).not.toContain(stored?.key);
  });

  it("revokes a user's API key at once and audits it once", async () => {
    const { id, key } = await createKey(target.userId, "CI deploys");
    expect(await keyStatus(key)).toBe(200);

    const response = await asAdmin("DELETE", `${target.userId}/api-keys/${id}`);

    expect(response.status).toBe(200);
    expect(await keyStatus(key)).toBe(401);
    const rows = await readAuditLog();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      action: "api_key.revoked",
      targetType: "user",
      targetId: target.userId,
      metadata: { keyId: id, keyName: "CI deploys" },
    });
    expect(JSON.stringify(rows)).not.toContain(key);
    expect(
      (await asAdmin("DELETE", `${target.userId}/api-keys/${id}`)).status,
    ).toBe(404);
  });

  it("does not revoke a key through another user's path", async () => {
    const { id, key } = await createKey(admin.userId, "Admin key");

    const response = await asAdmin("DELETE", `${target.userId}/api-keys/${id}`);

    expect(response.status).toBe(404);
    expect(await keyStatus(key)).toBe(200);
    expect(await readAuditLog()).toEqual([]);
  });
});
