import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import db, { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import { mockAnonymousSession, mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import { createWorkspaceMember } from "./helpers/fixtures";

const rawKey = "whoami-integration-key";
const hashedKey = createHash("sha256").update(rawKey).digest("base64url");

describe("API integration: current user identity", () => {
  beforeEach(async () => resetTestDatabase());

  it("returns the API-key owner without exposing key material", async () => {
    const member = await createWorkspaceMember();
    const now = new Date();
    await db.insert(schema.apikeyTable).values({
      referenceId: member.user.id,
      key: hashedKey,
      createdAt: now,
      updatedAt: now,
    });
    const { app } = createApp();

    const response = await app.request("/api/user/me", {
      headers: { Authorization: `Bearer ${rawKey}` },
    });

    expect(response.status).toBe(200);
    const body = await response.text();
    expect(JSON.parse(body)).toEqual({
      id: member.user.id,
      name: member.user.name,
      email: member.user.email,
      image: member.user.image,
    });
    expect(body).not.toContain(rawKey);
  });

  it("returns 401 for invalid and absent credentials", async () => {
    mockAnonymousSession();
    const { app } = createApp();
    for (const headers of [{ Authorization: "Bearer invalid-key" }, {}]) {
      const response = await app.request("/api/user/me", { headers });
      expect(response.status).toBe(401);
      expect(await response.text()).not.toContain("invalid-key");
    }
  });

  it("keeps session-authenticated user identity available", async () => {
    const member = await createWorkspaceMember();
    mockAuthenticatedSession(member.user);
    const { app } = createApp();

    const response = await app.request("/api/user/me");

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ id: member.user.id });
  });
});
