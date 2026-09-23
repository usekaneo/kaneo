import { beforeEach, expect, it } from "vitest";
import db, { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import { defaultRolePayloads } from "../../packages/permissions/src";
import { resetTestDatabase } from "./helpers/database";

const origin = "http://localhost:5173";
const { app } = createApp();
async function post(path: string, body: unknown, cookie = "") {
  return app.request(`/api/auth${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      Origin: origin,
      Cookie: cookie,
    },
    body: JSON.stringify(body),
  });
}
async function signup(email: string) {
  const result = await post("/sign-up/email", {
    name: "Role test",
    email,
    password: "long-password-for-tests",
  });
  expect(result.status).toBe(200);
  const body = await result.json();
  const cookie = result.headers
    .getSetCookie()
    .map((entry) => entry.split(";")[0])
    .join("; ");
  return { id: body.user.id as string, cookie };
}
beforeEach(() => resetTestDatabase());
it("revokes provider administrative permissions after the owner saves an empty role", async () => {
  const owner = await signup("owner@example.com");
  const admin = await signup("admin@example.com");
  const [workspace] = await db
    .insert(schema.workspaceTable)
    .values({
      id: "role-workspace",
      name: "Workspace",
      slug: "roles",
      createdAt: new Date(),
    })
    .returning();
  await db.insert(schema.workspaceUserTable).values([
    {
      workspaceId: workspace.id,
      userId: owner.id,
      role: "owner",
      joinedAt: new Date(),
    },
    {
      workspaceId: workspace.id,
      userId: admin.id,
      role: "admin",
      joinedAt: new Date(),
    },
  ]);
  await db.insert(schema.workspaceRoleTable).values({
    workspaceId: workspace.id,
    role: "admin",
    permission: JSON.stringify(defaultRolePayloads.admin),
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  const canManage = () =>
    post(
      "/organization/has-permission",
      {
        organizationId: workspace.id,
        permissions: {
          ac: ["update"],
          member: ["update"],
          invitation: ["create"],
        },
      },
      admin.cookie,
    );
  expect(await (await canManage()).json()).toMatchObject({ success: true });
  const demote = await post(
    "/organization/update-role",
    {
      organizationId: workspace.id,
      roleName: "admin",
      data: { permission: {} },
    },
    owner.cookie,
  );
  expect(demote.status).toBe(200);
  expect(await (await canManage()).json()).toMatchObject({ success: false });
  const restore = await post(
    "/organization/update-role",
    {
      organizationId: workspace.id,
      roleName: "admin",
      data: { permission: defaultRolePayloads.admin },
    },
    admin.cookie,
  );
  expect(restore.status).toBe(403);
});
