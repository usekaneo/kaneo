import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vite-plus/test";
import { auth } from "../../apps/api/src/auth";
import db, { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import { mockAuthenticatedSession } from "./helpers/auth";
import { signUpWithSession } from "./helpers/auth-session";
import { resetTestDatabase } from "./helpers/database";
import { createWorkspaceMember } from "./helpers/fixtures";
import { readErrorBody } from "./helpers/error-body";

describe("GET /api/user/me", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  it.each(["Authorization", "x-api-key"])(
    "returns the API-key owner using %s without a session",
    async (header) => {
      await createWorkspaceMember({ userName: "Other user" });
      const { user } = await createWorkspaceMember({ userName: "Key owner" });
      const { key } = await auth.api.createApiKey({
        body: { userId: user.id, name: "Current user test" },
      });
      const { app } = createApp();

      const response = await app.request("/api/user/me", {
        headers: {
          [header]: header === "Authorization" ? `Bearer ${key}` : key,
        },
      });

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({
        id: user.id,
        name: user.name,
        email: user.email,
        image: user.image,
        role: user.role,
        telegramHandle: null,
        managedProfileFields: [],
      });
    },
  );

  it("rejects missing credentials", async () => {
    const { app } = createApp();
    const response = await app.request("/api/user/me");

    expect(response.status).toBe(401);
    expect(await readErrorBody(response)).toMatchObject({
      message: "Unauthorized",
      code: "UNAUTHORIZED",
    });
  });

  it.each(["Authorization", "x-api-key"])(
    "rejects invalid credentials in %s",
    async (header) => {
      const { app } = createApp();
      const response = await app.request("/api/user/me", {
        headers: {
          [header]:
            header === "Authorization" ? "Bearer invalid-key" : "invalid-key",
        },
      });

      expect(response.status).toBe(401);
      expect(await readErrorBody(response)).toMatchObject({
        message: "Unauthorized",
        code: "UNAUTHORIZED",
      });
    },
  );

  it.each(["disabled", "expired"])("rejects a %s API key", async (state) => {
    const { user } = await createWorkspaceMember();
    const { id, key } = await auth.api.createApiKey({
      body: { userId: user.id, name: "Current user test" },
    });
    await db
      .update(schema.apikeyTable)
      .set(
        state === "disabled" ? { enabled: false } : { expiresAt: new Date(0) },
      )
      .where(eq(schema.apikeyTable.id, id));
    const { app } = createApp();

    const response = await app.request("/api/user/me", {
      headers: { Authorization: `Bearer ${key}` },
    });

    expect(response.status).toBe(401);
    expect(await readErrorBody(response)).toMatchObject({
      message: "Unauthorized",
      code: "UNAUTHORIZED",
    });
  });

  it("normalizes and clears the owner's Telegram handle", async () => {
    const { app } = createApp();
    const session = await signUpWithSession(app, {
      email: "telegram@example.com",
      name: "Telegram User",
    });

    const update = await app.request("/api/auth/update-user", {
      method: "POST",
      headers: { "content-type": "application/json", cookie: session.cookies },
      body: JSON.stringify({ telegramHandle: "@Alex_Name" }),
    });
    expect(update.status).toBe(200);

    const me = await app.request("/api/user/me", {
      headers: { cookie: session.cookies },
    });
    expect(await me.json()).toMatchObject({ telegramHandle: "alex_name" });

    const clear = await app.request("/api/auth/update-user", {
      method: "POST",
      headers: { "content-type": "application/json", cookie: session.cookies },
      body: JSON.stringify({ telegramHandle: "" }),
    });
    expect(clear.status).toBe(200);

    const cleared = await app.request("/api/user/me", {
      headers: { cookie: session.cookies },
    });
    expect(await cleared.json()).toMatchObject({ telegramHandle: null });
  });

  it("clears the owner's Telegram handle with null", async () => {
    const { app } = createApp();
    const session = await signUpWithSession(app, {
      email: "telegram-null@example.com",
      name: "Telegram Null",
    });

    const set = await app.request("/api/auth/update-user", {
      method: "POST",
      headers: { "content-type": "application/json", cookie: session.cookies },
      body: JSON.stringify({ telegramHandle: "@Alex_Name" }),
    });
    expect(set.status).toBe(200);

    const clear = await app.request("/api/auth/update-user", {
      method: "POST",
      headers: { "content-type": "application/json", cookie: session.cookies },
      body: JSON.stringify({ telegramHandle: null }),
    });
    expect(clear.status).toBe(200);

    const cleared = await app.request("/api/user/me", {
      headers: { cookie: session.cookies },
    });
    expect(await cleared.json()).toMatchObject({ telegramHandle: null });
  });

  it("rejects an invalid Telegram handle with 400", async () => {
    const { app } = createApp();
    const session = await signUpWithSession(app, {
      email: "telegram-invalid@example.com",
      name: "Telegram Invalid",
    });

    const response = await app.request("/api/auth/update-user", {
      method: "POST",
      headers: { "content-type": "application/json", cookie: session.cookies },
      body: JSON.stringify({ telegramHandle: "alex name" }),
    });

    expect(response.status).toBe(400);
  });

  it("returns 404 when the authenticated user no longer exists", async () => {
    const { user } = await createWorkspaceMember();
    // Preserve the authenticated identity to simulate deletion before the lookup.
    mockAuthenticatedSession(user);
    await db.delete(schema.userTable).where(eq(schema.userTable.id, user.id));
    const { app } = createApp();

    const response = await app.request("/api/user/me");

    expect(response.status).toBe(404);
    expect(await readErrorBody(response)).toMatchObject({
      message: "User not found",
      code: "NOT_FOUND",
    });
  });
});
