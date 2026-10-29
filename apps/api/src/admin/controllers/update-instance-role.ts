import {
  type CustomRolePermission,
  isCustomRolePermission,
} from "@kaneo/permissions";
import { eq, sql } from "drizzle-orm";
import db from "../../database";
import { instanceRoleTable, userTable } from "../../database/schema";
import type { AdminAuditRequest } from "../audit/admin-audit-request";
import { invalidateInstanceSettings } from "../../instance-settings/get-instance-settings";
import { recordAdminAction } from "../audit/record-admin-action";
import { assertRoleNameAvailable } from "../roles/assert-role-name-available";
import { findInstanceRole } from "../roles/find-instance-role";
import { lockInstanceRole } from "../roles/lock-instance-role";

type UpdateInstanceRoleInput = {
  name: string;
  permissions: CustomRolePermission[];
};

/** Rename a role or change its permissions. Users keep it across a rename. */
async function updateInstanceRole(
  roleId: string,
  input: UpdateInstanceRoleInput,
  audit: AdminAuditRequest,
) {
  const updated = await db.transaction(async (tx) => {
    const current = await lockInstanceRole(roleId, tx);
    const renamed = input.name !== current.name;
    if (renamed) await assertRoleNameAvailable(input.name, tx, roleId);

    await tx
      .update(instanceRoleTable)
      .set(input)
      .where(eq(instanceRoleTable.id, roleId));
    if (renamed) {
      const roles = sql`string_to_array(${userTable.role}, ',')`;
      await tx
        .update(userTable)
        .set({
          role: sql`array_to_string(array_replace(${roles}, ${current.name}, ${input.name}), ',')`,
        })
        .where(sql`${current.name} = ANY(${roles})`);
    }

    const before = current.permissions.filter(isCustomRolePermission);
    const added = input.permissions.filter((p) => !before.includes(p));
    const removed = before.filter((p) => !input.permissions.includes(p));
    if (renamed || added.length > 0 || removed.length > 0) {
      await recordAdminAction(
        {
          ...audit,
          action: "role.updated",
          targetType: "role",
          targetId: roleId,
          targetLabel: input.name,
          metadata: {
            ...(renamed
              ? { name: { from: current.name, to: input.name } }
              : {}),
            added,
            removed,
          },
        },
        tx,
      );
    }
    const role = await findInstanceRole(roleId, tx);
    if (!role) throw new Error("Instance role disappeared during update");
    return role;
  });
  // The cached default role is held by name.
  invalidateInstanceSettings();
  return updated;
}

export default updateInstanceRole;
