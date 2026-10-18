import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import type { WSContext } from "hono/ws";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import { auth } from "../../apps/api/src/auth";
import db, { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import { addUserConnection, removeUserConnection } from "../../apps/api/src/ws";
import { resetTestDatabase } from "./helpers/database";
import {
  enableBackchannelLogout,
  postLogoutToken,
  signLogoutToken,
} from "./helpers/logout-token";

async function seedUser(accountId?: string, providerId = "custom") {
  const [user] = await db
    .insert(schema.userTable)
    .values({
      id: `user-${randomUUID()}`,
      email: `${randomUUID()}@example.com`,
      emailVerified: true,
      name: "Provider User",
    })
    .returning();
  if (!user) throw new Error("Failed to seed user");
  if (accountId) {
    await db.insert(schema.accountTable).values({
      accountId,
      providerId,
      userId: user.id,
    });
  }
  return user;
}

async function seedSession(userId: string, oidcSid: string | null = null) {
  const id = randomUUID();
  await db.insert(schema.sessionTable).values({
    id,
    userId,
    token: randomUUID(),
    expiresAt: new Date(Date.now() + 60_000),
    oidcSid,
  });
  return id;
}

async function remainingSessionIds() {
  const sessions = await db
    .select({ id: schema.sessionTable.id })
    .from(schema.sessionTable);
  return sessions.map((session) => session.id).sort();
}

function fakeSocket() {
  return { send: vi.fn(), close: vi.fn() };
}

describe("API integration: back-channel logout", () => {
  let issuer: string;

  beforeEach(async () => {
    await resetTestDatabase();
    ({ issuer } = enableBackchannelLogout());
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("ends only the subject's sessions with the provider session ID", async () => {
    const user = await seedUser("kc-user-1");
    const other = await seedUser("kc-user-2");
    await seedSession(user.id, "kc-session-1");
    const otherProviderSession = await seedSession(user.id, "kc-session-2");
    const withoutSid = await seedSession(user.id);
    const otherUser = await seedSession(other.id, "kc-session-1");

    const response = await postLogoutToken(
      createApp().app,
      signLogoutToken(issuer, { sub: "kc-user-1", sid: "kc-session-1" }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.text()).toBe("");
    expect(await remainingSessionIds()).toEqual(
      [otherProviderSession, withoutSid, otherUser].sort(),
    );
  });

  it("ends the sessions with the provider session ID when no subject is sent", async () => {
    const user = await seedUser("kc-user-1");
    const other = await seedUser("kc-user-2");
    await seedSession(user.id, "kc-session-1");
    await seedSession(other.id, "kc-session-1");
    const kept = await seedSession(user.id, "kc-session-2");

    const response = await postLogoutToken(
      createApp().app,
      signLogoutToken(issuer, { sid: "kc-session-1" }),
    );

    expect(response.status).toBe(200);
    expect(await remainingSessionIds()).toEqual([kept]);
  });

  it("ends every session of the subject, closes its realtime connections and keeps its API keys", async () => {
    const user = await seedUser("kc-user-1");
    const other = await seedUser("kc-user-2");
    await seedSession(user.id, "kc-session-1");
    await seedSession(user.id);
    const kept = await seedSession(other.id, "kc-session-3");
    const { key } = await auth.api.createApiKey({
      body: { userId: user.id, name: "Logout test" },
    });
    const { app } = createApp();
    const socket = fakeSocket();
    const otherSocket = fakeSocket();
    const connection = addUserConnection(
      user.id,
      socket as unknown as WSContext,
    );
    const otherConnection = addUserConnection(
      other.id,
      otherSocket as unknown as WSContext,
    );
    try {
      const response = await postLogoutToken(
        app,
        signLogoutToken(issuer, { sub: "kc-user-1" }),
      );

      expect(response.status).toBe(200);
      expect(await remainingSessionIds()).toEqual([kept]);
      expect(socket.send).toHaveBeenCalledWith(
        JSON.stringify({ type: "USER_ACCESS_REVOKED" }),
      );
      expect(socket.close).toHaveBeenCalledWith(1008, "User access revoked");
      expect(otherSocket.close).not.toHaveBeenCalled();
      expect(
        (await app.request("/api/user/me", { headers: { "x-api-key": key } }))
          .status,
      ).toBe(200);
    } finally {
      removeUserConnection(user.id, connection);
      removeUserConnection(other.id, otherConnection);
    }
  });

  it("leaves users of other providers with the same account ID signed in", async () => {
    const user = await seedUser("12345");
    const githubUser = await seedUser("12345", "github");
    await seedSession(user.id);
    const kept = await seedSession(githubUser.id);

    const response = await postLogoutToken(
      createApp().app,
      signLogoutToken(issuer, { sub: "12345" }),
    );

    expect(response.status).toBe(200);
    expect(await remainingSessionIds()).toEqual([kept]);
  });

  it("keeps the realtime connections while the user has another session", async () => {
    const user = await seedUser("kc-user-1");
    await seedSession(user.id, "kc-session-1");
    const kept = await seedSession(user.id, "kc-session-2");
    const socket = fakeSocket();
    const connection = addUserConnection(
      user.id,
      socket as unknown as WSContext,
    );
    try {
      const response = await postLogoutToken(
        createApp().app,
        signLogoutToken(issuer, { sub: "kc-user-1", sid: "kc-session-1" }),
      );

      expect(response.status).toBe(200);
      expect(await remainingSessionIds()).toEqual([kept]);
      expect(socket.close).not.toHaveBeenCalled();
    } finally {
      removeUserConnection(user.id, connection);
    }
  });

  it("refuses a logout token the second time", async () => {
    const user = await seedUser("kc-user-1");
    await seedSession(user.id, "kc-session-1");
    const jti = randomUUID();
    const iat = Math.floor(Date.now() / 1000);
    const token = signLogoutToken(issuer, { sub: "kc-user-1", jti, iat });
    const { app } = createApp();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    expect((await postLogoutToken(app, token)).status).toBe(200);
    const replay = await postLogoutToken(app, token);

    expect(replay.status).toBe(400);
    expect(warn).toHaveBeenCalledWith(
      "Rejected a back-channel logout token: the logout token was used before",
    );
    expect(replay.headers.get("cache-control")).toBe("no-store");
    expect(await replay.json()).toEqual({ error: "invalid_request" });
    const [used, ...others] = await db
      .select()
      .from(schema.verificationTable)
      .where(
        eq(
          schema.verificationTable.identifier,
          `backchannel-logout:${issuer}:${jti}`,
        ),
      );
    expect(others).toHaveLength(0);
    expect(used?.expiresAt.getTime()).toBe((iat + 660) * 1000);
  });

  it("accepts only one of two identical logout tokens sent at once", async () => {
    const user = await seedUser("kc-user-1");
    await seedSession(user.id, "kc-session-1");
    const token = signLogoutToken(issuer, {
      sub: "kc-user-1",
      sid: "kc-session-1",
    });
    const { app } = createApp();
    vi.spyOn(console, "warn").mockImplementation(() => {});

    const responses = await Promise.all([
      postLogoutToken(app, token),
      postLogoutToken(app, token),
    ]);

    expect(responses.map((response) => response.status).sort()).toEqual([
      200, 400,
    ]);
    expect(await remainingSessionIds()).toEqual([]);
  });

  it("answers 200 for a subject without a Kaneo account", async () => {
    const user = await seedUser("kc-user-1");
    const kept = await seedSession(user.id, "kc-session-1");

    const response = await postLogoutToken(
      createApp().app,
      signLogoutToken(issuer, { sub: "kc-user-9", sid: "kc-session-1" }),
    );

    expect(response.status).toBe(200);
    expect(await remainingSessionIds()).toEqual([kept]);
  });

  it("answers 404 while back-channel logout is off", async () => {
    vi.stubEnv("CUSTOM_OAUTH_BACKCHANNEL_LOGOUT", "");

    const response = await postLogoutToken(
      createApp().app,
      signLogoutToken(issuer, { sub: "kc-user-1" }),
    );

    expect(response.status).toBe(404);
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("rejects a token for another client without recording it", async () => {
    const user = await seedUser("kc-user-1");
    const kept = await seedSession(user.id, "kc-session-1");
    vi.spyOn(console, "warn").mockImplementation(() => {});

    const response = await postLogoutToken(
      createApp().app,
      signLogoutToken(issuer, { sub: "kc-user-1", aud: "other-client" }),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "invalid_request" });
    expect(await remainingSessionIds()).toEqual([kept]);
    expect(await db.select().from(schema.verificationTable)).toHaveLength(0);
  });

  it("answers 503 while the discovery document cannot be loaded", async () => {
    const user = await seedUser("kc-user-1");
    const kept = await seedSession(user.id, "kc-session-1");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("down", { status: 500 })),
    );
    vi.spyOn(console, "warn").mockImplementation(() => {});

    const response = await postLogoutToken(
      createApp().app,
      signLogoutToken(issuer, { sub: "kc-user-1" }),
    );

    expect(response.status).toBe(503);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({ error: "temporarily_unavailable" });
    expect(await remainingSessionIds()).toEqual([kept]);
  });
});
