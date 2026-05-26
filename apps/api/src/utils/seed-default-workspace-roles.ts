import { DEFAULT_ROLE_NAMES, defaultRolePayloads } from "@kaneo/permissions";
import { and, inArray, sql } from "drizzle-orm";
import db, { schema } from "../database";

/**
 * Backfill the editable default roles (viewer/member/admin) for every
 * workspace that's missing them. Runs on API startup after Drizzle
 * migrations.
 *
 * These three roles used to be static (compiled into better-auth's
 * `roles` config). They were converted to DB rows so admins can override
 * them per workspace — but that means existing workspaces, which were
 * created before the switch, have no rows yet. Without this backfill,
 * better-auth's dynamic-access-control resolution would treat them as
 * having an empty permission set on existing workspaces.
 *
 * Idempotent: only inserts rows that aren't already present.
 */
export async function seedDefaultWorkspaceRoles() {
  try {
    const tableExists = await db.execute(sql`
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_name = 'workspace_role'
      ) AS exists;
    `);

    const exists =
      tableExists.rows[0]?.exists === true ||
      tableExists.rows[0]?.exists === "t";
    if (!exists) {
      console.log(
        "🛈 workspace_role table does not exist — skipping default-role seed.",
      );
      return;
    }

    const workspaces = await db
      .select({ id: schema.workspaceTable.id })
      .from(schema.workspaceTable);

    if (workspaces.length === 0) {
      return;
    }

    const workspaceIds = workspaces.map((w) => w.id);

    const existingRows = await db
      .select({
        workspaceId: schema.workspaceRoleTable.workspaceId,
        role: schema.workspaceRoleTable.role,
      })
      .from(schema.workspaceRoleTable)
      .where(
        and(
          inArray(schema.workspaceRoleTable.workspaceId, workspaceIds),
          inArray(
            schema.workspaceRoleTable.role,
            DEFAULT_ROLE_NAMES as unknown as string[],
          ),
        ),
      );

    const present = new Set(
      existingRows.map((r) => `${r.workspaceId}:${r.role}`),
    );

    const now = new Date();
    const rows: Array<typeof schema.workspaceRoleTable.$inferInsert> = [];
    for (const workspaceId of workspaceIds) {
      for (const name of DEFAULT_ROLE_NAMES) {
        if (present.has(`${workspaceId}:${name}`)) continue;
        rows.push({
          workspaceId,
          role: name,
          permission: JSON.stringify(defaultRolePayloads[name]),
          createdAt: now,
          updatedAt: now,
        });
      }
    }

    if (rows.length === 0) {
      return;
    }

    await db.insert(schema.workspaceRoleTable).values(rows);
    console.log(
      `✅ Seeded ${rows.length} default workspace role row(s) across ${workspaceIds.length} workspace(s).`,
    );
  } catch (error) {
    console.error("❌ Failed to seed default workspace roles:", error);
    throw error;
  }
}
