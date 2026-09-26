import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import db, { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import { signUpWithSession } from "./helpers/auth-session";
import { resetTestDatabase } from "./helpers/database";
import { createWorkspaceMember } from "./helpers/fixtures";

type App = ReturnType<typeof createApp>["app"];

async function updateUser(
  app: App,
  cookies: string,
  userId: string,
  data: Record<string, unknown>,
) {
  return app.request("/api/auth/admin/update-user", {
    method: "POST",
    headers: { "content-type": "application/json", cookie: cookies },
    body: JSON.stringify({ userId, data }),
  });
}

async function loadUser(userId: string) {
  const [user] = await db
    .select({
      email: schema.userTable.email,
      emailVerified: schema.userTable.emailVerified,
      name: schema.userTable.name,
    })
    .from(schema.userTable)
    .where(eq(schema.userTable.id, userId));
  return user;
}

describe("API integration: admin email change", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  it("clears emailVerified when an administrator changes a user's email", async () => {
    const { app } = createApp();
    const admin = await signUpWithSession(app, {
      email: "admin@example.com",
      name: "Instance Admin",
      role: "admin",
    });
    const target = await createWorkspaceMember({ role: "member" });
    expect((await loadUser(target.user.id))?.emailVerified).toBe(true);

    const response = await updateUser(app, admin.cookies, target.user.id, {
      email: "renamed@example.com",
    });

    expect(response.status).toBe(200);
    expect(await loadUser(target.user.id)).toMatchObject({
      email: "renamed@example.com",
      emailVerified: false,
    });
  });

  it("keeps emailVerified when the submitted email only differs in case or whitespace", async () => {
    const { app } = createApp();
    const admin = await signUpWithSession(app, {
      email: "admin@example.com",
      name: "Instance Admin",
      role: "admin",
    });
    const target = await createWorkspaceMember({ role: "member" });

    const response = await updateUser(app, admin.cookies, target.user.id, {
      email: target.user.email.toUpperCase(),
      name: "Renamed Member",
    });

    expect(response.status).toBe(200);
    expect(await loadUser(target.user.id)).toMatchObject({
      email: target.user.email,
      emailVerified: true,
      name: "Renamed Member",
    });
  });

  it("keeps emailVerified when the update does not touch the email", async () => {
    const { app } = createApp();
    const admin = await signUpWithSession(app, {
      email: "admin@example.com",
      name: "Instance Admin",
      role: "admin",
    });
    const target = await createWorkspaceMember({ role: "member" });

    const response = await updateUser(app, admin.cookies, target.user.id, {
      name: "Renamed Member",
    });

    expect(response.status).toBe(200);
    expect(await loadUser(target.user.id)).toMatchObject({
      emailVerified: true,
      name: "Renamed Member",
    });
  });
});
