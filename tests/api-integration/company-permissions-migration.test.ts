import { readFileSync } from "node:fs";
import { eq, sql } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import db, { schema } from "../../apps/api/src/database";
import { resetTestDatabase } from "./helpers/database";
import { createWorkspaceMember } from "./helpers/fixtures";

async function runMigration() {
  const file = new URL(
    "../../apps/api/drizzle/0049_grant_admin_company_permissions.sql",
    import.meta.url,
  );
  await db.execute(sql.raw(readFileSync(file, "utf8")));
}

beforeEach(async () => {
  await resetTestDatabase();
});

describe("admin company permission migration", () => {
  it("adds only the missing company resources to admin roles", async () => {
    const { workspace } = await createWorkspaceMember({ role: "owner" });
    await db.insert(schema.workspaceRoleTable).values([
      {
        workspaceId: workspace.id,
        role: "admin",
        // An owner already narrowed payroll to read-only; that must survive.
        permission: JSON.stringify({ task: ["read"], payroll: ["read"] }),
      },
      {
        workspaceId: workspace.id,
        role: "member",
        permission: JSON.stringify({ task: ["read"] }),
      },
      {
        workspaceId: workspace.id,
        role: "broken",
        permission: "not json",
      },
    ]);

    await runMigration();
    await runMigration();

    const rows = await db
      .select()
      .from(schema.workspaceRoleTable)
      .where(eq(schema.workspaceRoleTable.workspaceId, workspace.id));
    const byRole = Object.fromEntries(rows.map((r) => [r.role, r.permission]));

    expect(JSON.parse(byRole.admin)).toEqual({
      task: ["read"],
      payroll: ["read"],
      people: ["read_all", "manage"],
      activity: ["read_all"],
      request: ["approve"],
      audit: ["read"],
    });
    expect(JSON.parse(byRole.member)).toEqual({ task: ["read"] });
    expect(byRole.broken).toBe("not json");
  });
});
