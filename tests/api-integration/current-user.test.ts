import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { auth } from "../../apps/api/src/auth";
import db, { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import { mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import { createWorkspaceMember } from "./helpers/fixtures";

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
      });
    },
  );

  it("rejects missing credentials", async () => {
    const { app } = createApp();
    const response = await app.request("/api/user/me");

    expect(response.status).toBe(401);
    expect(await response.text()).toBe("Unauthorized");
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
      expect(await response.text()).toBe("Unauthorized");
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
    expect(await response.text()).toBe("Unauthorized");
  });

  it("returns 404 when the authenticated user no longer exists", async () => {
    const { user } = await createWorkspaceMember();
    // Preserve the authenticated identity to simulate deletion before the lookup.
    mockAuthenticatedSession(user);
    await db.delete(schema.userTable).where(eq(schema.userTable.id, user.id));
    const { app } = createApp();

    const response = await app.request("/api/user/me");

    expect(response.status).toBe(404);
    expect(await response.text()).toBe("User not found");
  });
});
