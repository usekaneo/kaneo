import { DEFAULT_ROLE_NAMES, defaultRolePayloads } from "@kaneo/permissions";
import { and, eq, inArray, sql } from "drizzle-orm";
import db, { schema } from "../database";
import {
  createDefaultWorkspaceRoleInsert,
  DEFAULT_ROLE_PERMISSION_UPGRADE_VERSION,
} from "./default-workspace-role";

type PermissionPayload = Record<string, unknown>;

/**
 * Adds only newly introduced default resources to an existing role payload.
 * Existing resources (including their actions) are never changed so workspace
 * administrators retain all custom permission choices.
 */
export function addMissingDefaultRoleResources(
  permission: string,
  newResources: Record<string, readonly string[]>,
): string | null {
  let payload: PermissionPayload;
  try {
    const parsed: unknown = JSON.parse(permission);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return null;
    }
    payload = parsed as PermissionPayload;
  } catch {
    return null;
  }

  const merged = { ...payload };
  let changed = false;
  for (const [resource, actions] of Object.entries(newResources)) {
    if (Object.hasOwn(payload, resource)) continue;
    merged[resource] = [...actions];
    changed = true;
  }

  return changed ? JSON.stringify(merged) : null;
}

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
 * Idempotent: inserts missing rows and adds only newly introduced resources to
 * existing default-role rows without overwriting customized resources.
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
        id: schema.workspaceRoleTable.id,
        workspaceId: schema.workspaceRoleTable.workspaceId,
        role: schema.workspaceRoleTable.role,
        permission: schema.workspaceRoleTable.permission,
        permissionUpgradeVersion:
          schema.workspaceRoleTable.permissionUpgradeVersion,
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

    const existingRowsByRole = new Map<string, typeof existingRows>();
    for (const row of existingRows) {
      const key = `${row.workspaceId}:${row.role}`;
      existingRowsByRole.set(key, [
        ...(existingRowsByRole.get(key) ?? []),
        row,
      ]);
    }

    const now = new Date();
    const rows: Array<typeof schema.workspaceRoleTable.$inferInsert> = [];
    const updates: Array<{ id: string; permission: string | null }> = [];
    for (const workspaceId of workspaceIds) {
      for (const name of DEFAULT_ROLE_NAMES) {
        const existingRowsForRole = existingRowsByRole.get(
          `${workspaceId}:${name}`,
        );
        if (existingRowsForRole) {
          const { item_type, saved_view } = defaultRolePayloads[name];
          if (!item_type || !saved_view) {
            continue;
          }
          const newResources: Record<string, readonly string[]> = {
            item_type,
            saved_view,
          };
          for (const existingRow of existingRowsForRole) {
            if (
              existingRow.permissionUpgradeVersion >=
              DEFAULT_ROLE_PERMISSION_UPGRADE_VERSION
            ) {
              continue;
            }
            const permission = addMissingDefaultRoleResources(
              existingRow.permission,
              newResources,
            );
            updates.push({ id: existingRow.id, permission });
          }
          continue;
        }
        rows.push(createDefaultWorkspaceRoleInsert(workspaceId, name, now));
      }
    }

    if (rows.length === 0 && updates.length === 0) {
      return;
    }

    // Postgres' bind protocol caps parameters at 65535 per query, so insert
    // in chunks. 6 columns × 1000 rows = 6000 params per batch, leaving ample
    // headroom even for instances with tens of thousands of workspaces.
    const BATCH_SIZE = 1000;
    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      await db
        .insert(schema.workspaceRoleTable)
        .values(rows.slice(i, i + BATCH_SIZE));
    }
    for (const update of updates) {
      await db
        .update(schema.workspaceRoleTable)
        .set({
          ...(update.permission ? { permission: update.permission } : {}),
          permissionUpgradeVersion: DEFAULT_ROLE_PERMISSION_UPGRADE_VERSION,
          updatedAt: now,
        })
        .where(eq(schema.workspaceRoleTable.id, update.id));
    }
    console.log(
      `✅ Seeded ${rows.length} and upgraded ${updates.length} default workspace role row(s) across ${workspaceIds.length} workspace(s).`,
    );
  } catch (error) {
    console.error("❌ Failed to seed default workspace roles:", error);
    throw error;
  }
}
