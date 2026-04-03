import { createHash, randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import db, { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import { resetTestDatabase } from "./helpers/database";
import { createWorkspaceMember } from "./helpers/fixtures";

const origin = "http://localhost:5173";

function mergeCookieJar(cookieJar: string, res: Response): string {
  const incoming = res.headers.getSetCookie?.() ?? [];
  if (incoming.length === 0) {
    return cookieJar;
  }
  const pairs = incoming.map((c) => c.split(";")[0]).filter(Boolean);
  const prefix = cookieJar ? `${cookieJar}; ` : "";
  return `${prefix}${pairs.join("; ")}`;
}

async function hashApiKeyForTest(key: string): Promise<string> {
  const hash = createHash("sha256").update(key).digest();
  return hash
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

async function signUpAndGetCookie(
  app: ReturnType<typeof createApp>["app"],
  email: string,
  password: string,
): Promise<string> {
  let jar = "csrf=1";
  const signUp = await app.request("/api/auth/sign-up/email", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      Origin: origin,
      Cookie: jar,
    },
    body: JSON.stringify({
      name: "Device flow user",
      email,
      password,
    }),
  });

  expect(signUp.status).toBe(200);
  jar = mergeCookieJar(jar, signUp);

  const signIn = await app.request("/api/auth/sign-in/email", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      Origin: origin,
      Cookie: jar,
    },
    body: JSON.stringify({ email, password }),
  });

  expect(signIn.status).toBe(200);
  jar = mergeCookieJar(jar, signIn);
  return jar;
}

describe("API integration: device authorization (RFC 8628)", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  it("returns device and user codes for an allowed client_id", async () => {
    const { app } = createApp();

    const res = await app.request("/api/auth/device/code", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        Origin: origin,
      },
      body: JSON.stringify({ client_id: "kaneo-cli" }),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.device_code).toEqual(expect.any(String));
    expect(body.user_code).toEqual(expect.any(String));
    expect(body.verification_uri).toEqual(expect.any(String));
    expect(body.interval).toEqual(expect.any(Number));
    expect(body.expires_in).toEqual(expect.any(Number));
  });

  it("rejects disallowed client_id", async () => {
    const { app } = createApp();

    const res = await app.request("/api/auth/device/code", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        Origin: origin,
      },
      body: JSON.stringify({ client_id: "unknown-client" }),
    });

    expect(res.status).toBe(400);
    const body = (await res.json()) as { error?: string };
    expect(body.error).toBe("invalid_client");
  });

  it("returns authorization_pending before approval", async () => {
    const { app } = createApp();

    const codeRes = await app.request("/api/auth/device/code", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        Origin: origin,
      },
      body: JSON.stringify({ client_id: "kaneo-cli" }),
    });
    const { device_code } = (await codeRes.json()) as { device_code: string };

    const tokenRes = await app.request("/api/auth/device/token", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        Origin: origin,
      },
      body: JSON.stringify({
        grant_type: "urn:ietf:params:oauth:grant-type:device_code",
        device_code,
        client_id: "kaneo-cli",
      }),
    });

    expect(tokenRes.status).toBe(400);
    const body = (await tokenRes.json()) as { error: string };
    expect(body.error).toBe("authorization_pending");
  });

  it("issues an access token after approval and allows API access with Bearer", async () => {
    const email = `device-${randomUUID()}@example.com`;
    const password = "device-flow-password-12345";

    const { app } = createApp();
    const cookieJar = await signUpAndGetCookie(app, email, password);

    const sessionRes = await app.request("/api/auth/get-session", {
      headers: {
        Cookie: cookieJar,
        Origin: origin,
      },
    });
    expect(sessionRes.status).toBe(200);
    const sessionJson = (await sessionRes.json()) as {
      user?: { id: string };
    };
    const userId = sessionJson.user?.id;
    if (!userId) {
      throw new Error("expected session user id after sign-in");
    }

    const workspaceId = `ws-${randomUUID()}`;
    await db.insert(schema.workspaceTable).values({
      id: workspaceId,
      name: "Device test workspace",
      slug: `slug-${randomUUID()}`,
      createdAt: new Date(),
    });
    await db.insert(schema.workspaceUserTable).values({
      workspaceId,
      userId,
      role: "owner",
      joinedAt: new Date(),
    });

    const codeRes = await app.request("/api/auth/device/code", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        Origin: origin,
      },
      body: JSON.stringify({ client_id: "kaneo-cli" }),
    });
    expect(codeRes.status).toBe(200);
    const devicePayload = (await codeRes.json()) as {
      device_code: string;
      user_code: string;
      interval: number;
    };

    const approveRes = await app.request("/api/auth/device/approve", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        Origin: origin,
        Cookie: cookieJar,
      },
      body: JSON.stringify({
        userCode: devicePayload.user_code,
      }),
    });
    expect(approveRes.status).toBe(200);

    let accessToken: string | undefined;
    const maxAttempts = 40;
    for (let i = 0; i < maxAttempts; i++) {
      if (i > 0) {
        await new Promise((r) =>
          setTimeout(r, devicePayload.interval * 1000 + 50),
        );
      }
      const tokenRes = await app.request("/api/auth/device/token", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          Origin: origin,
        },
        body: JSON.stringify({
          grant_type: "urn:ietf:params:oauth:grant-type:device_code",
          device_code: devicePayload.device_code,
          client_id: "kaneo-cli",
        }),
      });
      if (tokenRes.status === 200) {
        const t = (await tokenRes.json()) as { access_token?: string };
        accessToken = t.access_token;
        break;
      }
      const err = (await tokenRes.json()) as { error: string };
      if (err.error !== "authorization_pending" && err.error !== "slow_down") {
        throw new Error(`Unexpected token error: ${err.error}`);
      }
    }

    expect(accessToken).toBeTruthy();

    const organizationsRes = await app.request("/api/auth/organization/list", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    expect(organizationsRes.status).toBe(200);
    const organizations = (await organizationsRes.json()) as unknown[];
    expect(Array.isArray(organizations)).toBe(true);

    const projectsRes = await app.request(
      `/api/project?workspaceId=${encodeURIComponent(workspaceId)}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    );
    expect(projectsRes.status).toBe(200);
    const projects = (await projectsRes.json()) as unknown[];
    expect(Array.isArray(projects)).toBe(true);
  });

  it("still authenticates with a valid API key Bearer", async () => {
    const member = await createWorkspaceMember();

    const rawKey = `kaneo_test_${randomUUID()}`;
    const hashed = await hashApiKeyForTest(rawKey);
    const now = new Date();

    await db.insert(schema.apikeyTable).values({
      referenceId: member.user.id,
      userId: member.user.id,
      key: hashed,
      name: "integration device test",
      start: rawKey.slice(0, 12),
      prefix: "kaneo",
      createdAt: now,
      updatedAt: now,
    });

    const { app } = createApp();

    const res = await app.request(
      `/api/project?workspaceId=${encodeURIComponent(member.workspace.id)}`,
      {
        headers: {
          Authorization: `Bearer ${rawKey}`,
        },
      },
    );

    expect(res.status).toBe(200);

    const rows = await db
      .select()
      .from(schema.apikeyTable)
      .where(eq(schema.apikeyTable.key, hashed));
    expect(rows.length).toBe(1);
  });

  it("accepts a created API key Bearer on auth routes", async () => {
    const member = await createWorkspaceMember();
    const rawKey =
      randomUUID().replace(/-/g, "") + randomUUID().replace(/-/g, "");
    const hashed = await hashApiKeyForTest(rawKey);
    const now = new Date();

    await db.insert(schema.apikeyTable).values({
      referenceId: member.user.id,
      userId: member.user.id,
      key: hashed,
      name: "auth route api key",
      start: rawKey.slice(0, 12),
      createdAt: now,
      updatedAt: now,
    });

    const { app } = createApp();

    const authRouteRes = await app.request("/api/auth/organization/list", {
      headers: {
        Authorization: `Bearer ${rawKey}`,
      },
    });

    expect(authRouteRes.status).toBe(200);
  });

  it("rejects an invalid Bearer token even when a valid session cookie is present", async () => {
    const email = `device-bearer-${randomUUID()}@example.com`;
    const password = "device-flow-password-12345";

    const { app } = createApp();
    const cookieJar = await signUpAndGetCookie(app, email, password);

    const sessionRes = await app.request("/api/auth/get-session", {
      headers: {
        Cookie: cookieJar,
        Origin: origin,
      },
    });
    expect(sessionRes.status).toBe(200);
    const sessionJson = (await sessionRes.json()) as {
      user?: { id: string };
    };
    const userId = sessionJson.user?.id;
    if (!userId) {
      throw new Error("expected session user id after sign-in");
    }

    const workspaceId = `ws-${randomUUID()}`;
    await db.insert(schema.workspaceTable).values({
      id: workspaceId,
      name: "Bearer fallback workspace",
      slug: `slug-${randomUUID()}`,
      createdAt: new Date(),
    });
    await db.insert(schema.workspaceUserTable).values({
      workspaceId,
      userId,
      role: "owner",
      joinedAt: new Date(),
    });

    const res = await app.request(
      `/api/project?workspaceId=${encodeURIComponent(workspaceId)}`,
      {
        headers: {
          Authorization: "Bearer definitely-not-a-real-token",
          Cookie: cookieJar,
          Origin: origin,
        },
      },
    );

    expect(res.status).toBe(401);

    const lowercaseSchemeRes = await app.request(
      `/api/project?workspaceId=${encodeURIComponent(workspaceId)}`,
      {
        headers: {
          authorization: "bearer definitely-not-a-real-token",
          Cookie: cookieJar,
          Origin: origin,
        },
      },
    );

    expect(lowercaseSchemeRes.status).toBe(401);
  });
});
