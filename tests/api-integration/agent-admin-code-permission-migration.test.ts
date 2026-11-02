import { readFileSync } from "node:fs";
import { eq, sql } from "drizzle-orm";
import { beforeEach, expect, it } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import { hasUserWorkspacePermission } from "../../apps/api/src/utils/require-workspace-permission";
import { seedDefaultWorkspaceRoles } from "../../apps/api/src/utils/seed-default-workspace-roles";
import { createWorkspaceMember } from "./helpers/fixtures";
import { resetTestDatabase } from "./helpers/database";

const migration = readFileSync(
  new URL(
    "../../apps/api/drizzle/0082_agent_admin_code_permission.sql",
    import.meta.url,
  ),
  "utf8",
);

beforeEach(resetTestDatabase);

it("upgrades an existing admin without restoring unrelated customized grants", async () => {
  const { user, workspace } = await createWorkspaceMember({ role: "admin" });
  const permissions = {
    agent: ["manage_automations", "future_agent_action"],
    project: ["read"],
    task: ["read", "create"],
    workspace: ["read", "manage_settings"],
    custom_resource: ["custom_action"],
  };
  const [role] = await db
    .insert(schema.workspaceRoleTable)
    .values({
      workspaceId: workspace.id,
      role: "admin",
      permission: JSON.stringify(permissions),
    })
    .returning();
  const allowsCode = () =>
    hasUserWorkspacePermission(user.id, workspace.id, { agent: ["run_code"] });

  expect(await allowsCode()).toBe(false);
  await seedDefaultWorkspaceRoles();
  expect(await allowsCode()).toBe(false);

  await db.execute(sql.raw(migration));
  expect(await allowsCode()).toBe(true);
  expect(
    await hasUserWorkspacePermission(user.id, workspace.id, {
      task: ["delete"],
    }),
  ).toBe(false);
  const [upgraded] = await db
    .select()
    .from(schema.workspaceRoleTable)
    .where(eq(schema.workspaceRoleTable.id, role!.id));
  expect(JSON.parse(upgraded!.permission)).toEqual({
    ...permissions,
    agent: [...permissions.agent, "run_code"],
  });

  await db.execute(sql.raw(migration));
  const [repeated] = await db
    .select()
    .from(schema.workspaceRoleTable)
    .where(eq(schema.workspaceRoleTable.id, role!.id));
  expect(repeated).toEqual(upgraded);
});

it("adds the missing agent grant without changing other permissions", async () => {
  const { user, workspace } = await createWorkspaceMember({ role: "admin" });
  const permissions = { project: ["read"], task: ["read"] };
  const [role] = await db
    .insert(schema.workspaceRoleTable)
    .values({
      workspaceId: workspace.id,
      role: "admin",
      permission: JSON.stringify(permissions),
    })
    .returning();

  await db.execute(sql.raw(migration));
  const [upgraded] = await db
    .select()
    .from(schema.workspaceRoleTable)
    .where(eq(schema.workspaceRoleTable.id, role!.id));
  expect(JSON.parse(upgraded!.permission)).toEqual({
    ...permissions,
    agent: ["run_code"],
  });
  expect(
    await hasUserWorkspacePermission(user.id, workspace.id, {
      agent: ["run_code"],
    }),
  ).toBe(true);
});

it("leaves members, viewers, custom roles, and already upgraded admins unchanged", async () => {
  const { workspace } = await createWorkspaceMember();
  const permission = JSON.stringify({
    agent: ["manage_automations"],
    task: ["read", "update"],
  });
  const before = await db
    .insert(schema.workspaceRoleTable)
    .values([
      ...["member", "viewer", "custom-admin"].map((role) => ({
        workspaceId: workspace.id,
        role,
        permission,
      })),
      {
        workspaceId: workspace.id,
        role: "admin",
        permission: '{ "agent": ["run_code"], "task": ["read"] }',
      },
    ])
    .returning();

  await db.execute(sql.raw(migration));
  const after = await db
    .select()
    .from(schema.workspaceRoleTable)
    .where(eq(schema.workspaceRoleTable.workspaceId, workspace.id));
  expect(after).toEqual(expect.arrayContaining(before));
  expect(after).toHaveLength(before.length);
});
