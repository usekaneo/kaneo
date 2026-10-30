import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import { auth } from "../../apps/api/src/auth";
import { createApp } from "../../apps/api/src/index";
import { SESSION_ENDED_CLOSE_CODE } from "../../apps/api/src/ws";
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
type SessionList = {
  sessions: Array<Record<string, unknown> & { id: string; current: boolean }>;
};

let app: App;
let me: { userId: string; cookies: string };
let laptop: string;

const listSessions = (headers: Record<string, string>) =>
  app.request("/api/user/sessions", { headers });

const revokeSession = (sessionId: string, headers: Record<string, string>) =>
  app.request(`/api/user/sessions/${sessionId}`, {
    method: "DELETE",
    headers: { origin: "http://localhost:5173", ...headers },
  });

beforeEach(async () => {
  await resetTestDatabase();
  ({ app } = createApp());
  me = await signUpWithSession(app, {
    email: "me@example.com",
    name: "Mia Me",
  });
  laptop = await signIn(app, "me@example.com", {
    "user-agent": FIREFOX_ON_LINUX,
  });
});

afterEach(() => disconnectSockets());

describe("API integration: own sessions", () => {
  it("lists the caller's sessions without tokens, current first", async () => {
    const response = await listSessions({ cookie: me.cookies });

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    const body = (await response.json()) as SessionList;
    expect(body.sessions).toHaveLength(3);
    expect(body.sessions[0]).toMatchObject({
      id: await sessionIdOf(me.cookies),
      current: true,
    });
    expect(body.sessions.filter((session) => session.current)).toHaveLength(1);
    const laptopId = await sessionIdOf(laptop);
    const laptopSession = body.sessions.find(({ id }) => id === laptopId);
    expect(laptopSession).toMatchObject({
      browser: "Firefox",
      os: "Linux",
      current: false,
    });
    expect(Object.keys(laptopSession ?? {}).sort()).toEqual([
      "browser",
      "createdAt",
      "current",
      "expiresAt",
      "id",
      "ipAddress",
      "lastActiveAt",
      "os",
    ]);
    const text = JSON.stringify(body);
    for (const token of await sessionTokens())
      expect(text).not.toContain(token);
  });

  it("signs out another session at once, closing only its sockets", async () => {
    const laptopId = await sessionIdOf(laptop);
    const currentId = await sessionIdOf(me.cookies);
    const laptopSocket = connectSocket(me.userId, laptopId);
    const currentSocket = connectSocket(me.userId, currentId);

    const response = await revokeSession(laptopId, { cookie: me.cookies });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ revoked: 1 });
    expect(await meStatus(app, laptop)).toBe(401);
    expect(await meStatus(app, me.cookies)).toBe(200);
    expect(laptopSocket.close).toHaveBeenCalledWith(
      SESSION_ENDED_CLOSE_CODE,
      "Session ended",
    );
    expect(currentSocket.close).not.toHaveBeenCalled();
  });

  it("refuses to end the current session; that is signing out", async () => {
    const response = await revokeSession(await sessionIdOf(me.cookies), {
      cookie: me.cookies,
    });

    expect(response.status).toBe(409);
    expect(await meStatus(app, me.cookies)).toBe(200);
  });

  it("cannot see or end another user's sessions", async () => {
    const other = await signUpWithSession(app, {
      email: "other@example.com",
      name: "Oli Other",
    });
    const otherSessionId = await sessionIdOf(other.cookies);

    const list = (await (
      await listSessions({ cookie: me.cookies })
    ).json()) as SessionList;
    const response = await revokeSession(otherSessionId, {
      cookie: me.cookies,
    });

    expect(list.sessions.map((session) => session.id)).not.toContain(
      otherSessionId,
    );
    expect(response.status).toBe(404);
    expect(await sessionIdsOf(other.userId)).toContain(otherSessionId);
    expect(await meStatus(app, other.cookies)).toBe(200);
  });

  it("rejects API keys and anonymous callers", async () => {
    const { key } = await auth.api.createApiKey({
      body: { userId: me.userId, name: "Sessions test" },
    });
    const laptopId = await sessionIdOf(laptop);

    expect((await listSessions({ "x-api-key": key })).status).toBe(403);
    expect((await revokeSession(laptopId, { "x-api-key": key })).status).toBe(
      403,
    );
    expect((await listSessions({})).status).toBe(401);
    expect((await revokeSession(laptopId, {})).status).toBe(401);
    expect(await meStatus(app, laptop)).toBe(200);
  });

  it("closes the sockets of sessions ended by revoke-other-sessions", async () => {
    const laptopSocket = connectSocket(me.userId, await sessionIdOf(laptop));
    const currentSocket = connectSocket(
      me.userId,
      await sessionIdOf(me.cookies),
    );

    const response = await app.request("/api/auth/revoke-other-sessions", {
      method: "POST",
      headers: {
        cookie: me.cookies,
        origin: "http://localhost:5173",
        "content-type": "application/json",
      },
      body: "{}",
    });

    expect(response.status).toBe(200);
    expect(await meStatus(app, laptop)).toBe(401);
    expect(laptopSocket.close).toHaveBeenCalledWith(
      SESSION_ENDED_CLOSE_CODE,
      "Session ended",
    );
    expect(currentSocket.close).not.toHaveBeenCalled();
  });
});
