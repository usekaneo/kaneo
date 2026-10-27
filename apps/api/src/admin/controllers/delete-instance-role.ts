import { count, eq, sql } from "drizzle-orm";
import db from "../../database";
import { instanceRoleTable, userTable } from "../../database/schema";
import { ApiError } from "../../errors/api-error";
import type { AdminAuditRequest } from "../audit/admin-audit-request";
import { recordAdminAction } from "../audit/record-admin-action";
import { lockInstanceRole } from "../roles/lock-instance-role";

/** Delete a role nobody has. Assignments share-lock the role row first. */
async function deleteInstanceRole(roleId: string, audit: AdminAuditRequest) {
  return db.transaction(async (tx) => {
    const role = await lockInstanceRole(roleId, tx);
    const [assigned] = await tx
      .select({ value: count() })
      .from(userTable)
      .where(sql`${role.name} = ANY(string_to_array(${userTable.role}, ','))`);
    const userCount = assigned?.value ?? 0;
    if (userCount > 0) {
      throw new ApiError(409, {
        code: "ROLE_IN_USE",
        message: `This role is assigned to ${userCount} ${userCount === 1 ? "user" : "users"}. Give them another role first.`,
      });
    }

    await tx.delete(instanceRoleTable).where(eq(instanceRoleTable.id, roleId));
    await recordAdminAction(
      {
        ...audit,
        action: "role.deleted",
        targetType: "role",
        targetId: roleId,
        targetLabel: role.name,
        metadata: { permissions: role.permissions },
      },
      tx,
    );
    return { id: roleId };
  });
}

export default deleteInstanceRole;
