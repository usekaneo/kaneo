import { eq } from "drizzle-orm";
import { instanceRoleTable } from "../../database/schema";
import { ApiError } from "../../errors/api-error";
import type { DbOrTx } from "../../project-access/db-or-tx";

/** The role row, locked until the transaction ends, or a 404. */
export async function lockInstanceRole(roleId: string, tx: DbOrTx) {
  const [role] = await tx
    .select({
      id: instanceRoleTable.id,
      name: instanceRoleTable.name,
      permissions: instanceRoleTable.permissions,
    })
    .from(instanceRoleTable)
    .where(eq(instanceRoleTable.id, roleId))
    .limit(1)
    .for("update");
  if (!role) {
    throw new ApiError(404, {
      code: "ROLE_NOT_FOUND",
      message: "Role not found",
    });
  }
  return role;
}
