import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { auth } from "../../apps/api/src/auth";
import db, { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import * as logoutController from "../../apps/api/src/oauth/controllers/build-logout-url";
import { resetTestDatabase } from "./helpers/database";

const origin = "http://localhost:5173";
const provider = "https://idp.example/logout";

async function signedInBrowser() {
  const { app } = createApp();
  const response = await app.request("/api/auth/sign-up/email", {
    method: "POST",
    headers: { "content-type": "application/json", origin },
    body: JSON.stringify({
      name: "Logout test",
      email: `${randomUUID()}@example.com`,
      password: "logout-test-password-12345",
    }),
  });
  expect(response.status).toBe(200);
  const { user } = (await response.json()) as { user: { id: string } };
  const cookie = response.headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .join("; ");
  await db.insert(schema.accountTable).values({
    accountId: randomUUID(),
    providerId: "custom",
    userId: user.id,
    idToken: "stored-id-token",
  });
  return { app, userId: user.id, cookie };
}

function expectClearedCookies(response: Response) {
  const cookies = response.headers.getSetCookie();
  expect(cookies.length).toBeGreaterThan(0);
  expect(
    cookies.some(
      (cookie) =>
        cookie.includes("session_token=;") && cookie.includes("Max-Age=0"),
    ),
  ).toBe(true);
  expect(response.headers.get("cache-control")).toBe("no-store");
}

beforeEach(async () => {
  await resetTestDatabase();
  vi.stubEnv("CUSTOM_OAUTH_LOGOUT_URL", provider);
});

afterEach(() => vi.unstubAllEnvs());

describe("OIDC logout navigation", () => {
  it("ends the real session and forwards cleared cookies before redirecting to the provider", async () => {
    const { app, userId, cookie } = await signedInBrowser();
    const response = await app.request("/api/oauth/logout", {
      headers: { cookie, referer: `${origin}/settings` },
    });
    expect(response.status).toBe(302);
    const location = new URL(response.headers.get("location") ?? "");
    expect(location.origin).toBe("https://idp.example");
    expect(location.searchParams.get("id_token_hint")).toBe("stored-id-token");
    expect(location.searchParams.get("post_logout_redirect_uri")).toBe(
      `${origin}/auth/sign-in`,
    );
    expectClearedCookies(response);
    expect(await response.text()).not.toContain("stored-id-token");
    expect(
      await db
        .select()
        .from(schema.sessionTable)
        .where(eq(schema.sessionTable.userId, userId)),
    ).toHaveLength(0);
    const session = await app.request("/api/auth/get-session", {
      headers: { cookie },
    });
    expect(await session.json()).toBeNull();
  });

  it("finishes logout with an expired session without disclosing the stored token", async () => {
    const { app, userId, cookie } = await signedInBrowser();
    await db
      .update(schema.sessionTable)
      .set({ expiresAt: new Date(0) })
      .where(eq(schema.sessionTable.userId, userId));
    const response = await app.request("/api/oauth/logout", {
      headers: { cookie, referer: origin },
    });
    expect(response.status).toBe(302);
    expectClearedCookies(response);
    const location = new URL(response.headers.get("location") ?? "");
    expect(location.origin).toBe("https://idp.example");
    expect(location.searchParams.has("id_token_hint")).toBe(false);
  });

  it("finishes logout when the browser has already lost its session cookie", async () => {
    const { app } = createApp();
    const response = await app.request("/api/oauth/logout", {
      headers: { referer: origin },
    });
    expect(response.status).toBe(302);
    expectClearedCookies(response);
    expect(
      new URL(response.headers.get("location") ?? "").searchParams.has(
        "id_token_hint",
      ),
    ).toBe(false);
  });

  it.each(["", "not-a-url", "http://idp.example/logout"])(
    "still clears the session with unusable provider configuration %s",
    async (configured) => {
      vi.stubEnv("CUSTOM_OAUTH_LOGOUT_URL", configured);
      const { app, cookie } = await signedInBrowser();
      const response = await app.request("/api/oauth/logout", {
        headers: { cookie, referer: origin },
      });
      expect(response.status).toBe(302);
      expect(response.headers.get("location")).toBe(`${origin}/auth/sign-in`);
      expectClearedCookies(response);
    },
  );

  it.each([undefined, "invalid-url", "https://untrusted.example/path"])(
    "rejects an untrusted navigation (%s) without ending the session",
    async (referer) => {
      const { app, userId, cookie } = await signedInBrowser();
      const response = await app.request("/api/oauth/logout", {
        headers: { cookie, ...(referer ? { referer } : {}) },
      });
      expect(response.status).toBe(403);
      expect(response.headers.has("location")).toBe(false);
      expect(response.headers.getSetCookie()).toHaveLength(0);
      expect(
        await db
          .select()
          .from(schema.sessionTable)
          .where(eq(schema.sessionTable.userId, userId)),
      ).toHaveLength(1);
    },
  );

  it.each(["x-api-key", "authorization"])(
    "rejects %s even alongside a valid browser session",
    async (header) => {
      const { app, userId, cookie } = await signedInBrowser();
      const { key } = await auth.api.createApiKey({
        body: { userId, name: "Logout rejection test" },
      });
      const response = await app.request("/api/oauth/logout", {
        headers: {
          cookie,
          referer: origin,
          [header]: header === "authorization" ? `Bearer ${key}` : key,
        },
      });
      expect(response.status).toBe(403);
      expect(response.headers.has("location")).toBe(false);
      expect(
        await db
          .select()
          .from(schema.sessionTable)
          .where(eq(schema.sessionTable.userId, userId)),
      ).toHaveLength(1);
    },
  );

  it("does not redirect as though logout succeeded when sign-out returns an error response", async () => {
    const { app, cookie } = await signedInBrowser();
    vi.spyOn(auth.api, "signOut").mockResolvedValueOnce(
      new Response("sign-out failed", { status: 500 }),
    );
    const response = await app.request("/api/oauth/logout", {
      headers: { cookie, referer: origin },
    });
    expect(response.status).toBe(500);
    expect(response.headers.has("location")).toBe(false);
  });

  it("falls back to local sign-out when the provider token lookup fails", async () => {
    const { app, userId, cookie } = await signedInBrowser();
    vi.spyOn(logoutController, "default").mockRejectedValueOnce(
      new Error("token lookup failed"),
    );
    const response = await app.request("/api/oauth/logout", {
      headers: { cookie, referer: origin },
    });
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe(`${origin}/auth/sign-in`);
    expectClearedCookies(response);
    expect(
      await db
        .select()
        .from(schema.sessionTable)
        .where(eq(schema.sessionTable.userId, userId)),
    ).toHaveLength(0);
  });

  it("returns an error without redirecting when session lookup fails", async () => {
    const { app, cookie } = await signedInBrowser();
    vi.spyOn(auth.api, "getSession").mockRejectedValueOnce(
      new Error("session lookup failed"),
    );
    const signOut = vi.spyOn(auth.api, "signOut");
    const response = await app.request("/api/oauth/logout", {
      headers: { cookie, referer: origin },
    });
    expect(response.status).toBe(500);
    expect(response.headers.has("location")).toBe(false);
    expect(signOut).not.toHaveBeenCalled();
  });

  it("accepts a same-origin API navigation", async () => {
    const { app, cookie } = await signedInBrowser();
    const response = await app.request("/api/oauth/logout", {
      headers: { cookie, referer: "http://localhost:1337/settings" },
    });
    expect(response.status).toBe(302);
    expectClearedCookies(response);
  });

  it("uses only the signed-in user's custom provider token", async () => {
    const other = await signedInBrowser();
    await db
      .update(schema.accountTable)
      .set({ idToken: "other-user-token" })
      .where(eq(schema.accountTable.userId, other.userId));
    const { app, cookie } = await signedInBrowser();
    const response = await app.request("/api/oauth/logout", {
      headers: { cookie, referer: origin },
    });
    expect(response.status).toBe(302);
    expect(
      new URL(response.headers.get("location") ?? "").searchParams.get(
        "id_token_hint",
      ),
    ).toBe("stored-id-token");
    expect(
      await db
        .select()
        .from(schema.sessionTable)
        .where(eq(schema.sessionTable.userId, other.userId)),
    ).toHaveLength(1);
  });

  it("does not make other API routes public", async () => {
    const { app } = createApp();
    const response = await app.request("/api/project?workspaceId=unknown", {
      headers: { referer: origin },
    });
    expect(response.status).toBe(401);
  });
});
