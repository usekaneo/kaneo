import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import db, { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import { signUpWithSession } from "./helpers/auth-session";
import { resetTestDatabase } from "./helpers/database";
import { createWorkspaceMember } from "./helpers/fixtures";

type App = ReturnType<typeof createApp>["app"];

async function addMember(workspaceId: string, role: string) {
  const userId = `user-${randomUUID()}`;
  const [user] = await db
    .insert(schema.userTable)
    .values({
      id: userId,
      email: `${userId}@example.com`,
      emailVerified: true,
      name: "Other Member",
    })
    .returning();
  await db.insert(schema.workspaceUserTable).values({
    workspaceId,
    userId: user.id,
    role,
    joinedAt: new Date(),
  });
  return user;
}

async function seedCredentials(userId: string) {
  const now = new Date();
  await db.insert(schema.sessionTable).values({
    id: `session-${userId}`,
    token: `token-${userId}`,
    userId,
    expiresAt: new Date(now.getTime() + 60 * 60 * 1000),
    createdAt: now,
    updatedAt: now,
  });
  await db.insert(schema.accountTable).values({
    accountId: userId,
    providerId: "credential",
    userId,
    password: "hashed",
  });
}

async function removeUser(app: App, cookies: string, userId: string) {
  return app.request("/api/auth/admin/remove-user", {
    method: "POST",
    headers: { "content-type": "application/json", cookie: cookies },
    body: JSON.stringify({ userId }),
  });
}

async function countRows(userId: string, workspaceId: string) {
  const [users, sessions, accounts, workspaces] = await Promise.all([
    db.select().from(schema.userTable).where(eq(schema.userTable.id, userId)),
    db
      .select()
      .from(schema.sessionTable)
      .where(eq(schema.sessionTable.userId, userId)),
    db
      .select()
      .from(schema.accountTable)
      .where(eq(schema.accountTable.userId, userId)),
    db
      .select()
      .from(schema.workspaceTable)
      .where(eq(schema.workspaceTable.id, workspaceId)),
  ]);
  return {
    users: users.length,
    sessions: sessions.length,
    accounts: accounts.length,
    workspaces: workspaces.length,
  };
}

describe("API integration: admin user removal", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  it("deletes the workspace a sole member owned together with the user", async () => {
    const { app } = createApp();
    const admin = await signUpWithSession(app, {
      email: "admin@example.com",
      name: "Instance Admin",
      role: "admin",
    });
    const target = await createWorkspaceMember({ role: "owner" });
    await seedCredentials(target.user.id);

    const response = await removeUser(app, admin.cookies, target.user.id);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ success: true });
    expect(await countRows(target.user.id, target.workspace.id)).toEqual({
      users: 0,
      sessions: 0,
      accounts: 0,
      workspaces: 0,
    });
  });

  it("refuses to remove the only owner of a shared workspace and keeps the account intact", async () => {
    const { app } = createApp();
    const admin = await signUpWithSession(app, {
      email: "admin@example.com",
      name: "Instance Admin",
      role: "admin",
    });
    const target = await createWorkspaceMember({
      role: "owner",
      workspaceName: "Acme",
    });
    await addMember(target.workspace.id, "member");
    await seedCredentials(target.user.id);

    const response = await removeUser(app, admin.cookies, target.user.id);

    expect(response.status).toBe(409);
    const body = (await response.json()) as { message?: string };
    expect(body.message).toMatch(/only owner of "Acme"/);
    expect(await countRows(target.user.id, target.workspace.id)).toEqual({
      users: 1,
      sessions: 1,
      accounts: 1,
      workspaces: 1,
    });
  });

  it("rejects callers who are not instance administrators without touching data", async () => {
    const { app } = createApp();
    await signUpWithSession(app, {
      email: "admin@example.com",
      name: "Instance Admin",
      role: "admin",
    });
    const caller = await signUpWithSession(app, {
      email: "member@example.com",
      name: "Regular Member",
      role: "user",
    });
    const target = await createWorkspaceMember({ role: "owner" });
    await seedCredentials(target.user.id);

    const response = await removeUser(app, caller.cookies, target.user.id);

    expect(response.status).toBe(403);
    expect(await countRows(target.user.id, target.workspace.id)).toEqual({
      users: 1,
      sessions: 1,
      accounts: 1,
      workspaces: 1,
    });
  });

  it("rejects unauthenticated callers", async () => {
    const { app } = createApp();
    const target = await createWorkspaceMember({ role: "owner" });

    const response = await removeUser(app, "", target.user.id);

    expect(response.status).toBe(403);
    expect(await countRows(target.user.id, target.workspace.id)).toMatchObject({
      users: 1,
      workspaces: 1,
    });
  });

  it("does not let an administrator remove their own account through the admin endpoint", async () => {
    const { app } = createApp();
    const admin = await signUpWithSession(app, {
      email: "admin@example.com",
      name: "Instance Admin",
      role: "admin",
    });

    const response = await removeUser(app, admin.cookies, admin.userId);

    expect(response.status).toBe(400);
    const remaining = await db
      .select()
      .from(schema.userTable)
      .where(eq(schema.userTable.id, admin.userId));
    expect(remaining).toHaveLength(1);
  });

  describe("with billing enabled", () => {
    const cloudEnv = {
      KANEO_CLOUD: "true",
      CREEM_API_KEY: "creem_test_dummy",
      CREEM_WEBHOOK_SECRET: "whsec_dummy",
    };
    const saved: Record<string, string | undefined> = {};

    beforeAll(() => {
      for (const [key, value] of Object.entries(cloudEnv)) {
        saved[key] = process.env[key];
        process.env[key] = value;
      }
    });

    afterAll(() => {
      for (const key of Object.keys(cloudEnv)) {
        if (saved[key] === undefined) {
          delete process.env[key];
        } else {
          process.env[key] = saved[key];
        }
      }
    });

    it("refuses to remove the only member of a workspace with an active subscription", async () => {
      const { app } = createApp();
      const admin = await signUpWithSession(app, {
        email: "admin@example.com",
        name: "Instance Admin",
        role: "admin",
      });
      const owner = await createWorkspaceMember({
        role: "owner",
        workspaceName: "Paid Space",
      });
      await seedCredentials(owner.user.id);
      await db.insert(schema.workspaceBillingTable).values({
        workspaceId: owner.workspace.id,
        creemSubscriptionId: "sub_active",
        creemProductId: "prod_1",
        plan: "team",
        status: "active",
      });

      const response = await removeUser(app, admin.cookies, owner.user.id);

      expect(response.status).toBe(409);
      expect(await response.text()).toMatch(
        /Paid Space.* still has an active subscription/,
      );
      expect(await countRows(owner.user.id, owner.workspace.id)).toEqual({
        users: 1,
        sessions: 1,
        accounts: 1,
        workspaces: 1,
      });
      const memberships = await db
        .select()
        .from(schema.workspaceUserTable)
        .where(eq(schema.workspaceUserTable.userId, owner.user.id));
      expect(memberships).toHaveLength(1);
    });
  });
});
