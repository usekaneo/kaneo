import { isCustomRolePermission } from "@kaneo/permissions";
import { eq } from "drizzle-orm";
import { instanceRoleTable } from "../../database/schema";
import { ApiError } from "../../errors/api-error";
import type { DbOrTx } from "../../project-access/db-or-tx";
import { holdsAll, type InstanceAccess } from "./get-instance-access";

/**
 * Check the caller may give someone `role`. Call inside the transaction that
 * assigns it: the role row stays share-locked so it can't be deleted or
 * renamed before the assignment commits.
 */
export async function assertAssignableRole(
  role: string,
  actor: InstanceAccess,
  tx: DbOrTx,
) {
  if (role === "user") return;
  if (role === "admin") {
    if (!actor.isAdmin) {
      throw new ApiError(403, {
        code: "ADMIN_ROLE_REQUIRED",
        message: "Only administrators can make someone an administrator.",
      });
    }
    return;
  }

  const [row] = await tx
    .select({ permissions: instanceRoleTable.permissions })
    .from(instanceRoleTable)
    .where(eq(instanceRoleTable.name, role))
    .limit(1)
    .for("share");
  if (!row) {
    throw new ApiError(400, {
      code: "UNKNOWN_ROLE",
      message: "This role does not exist.",
    });
  }
  if (!holdsAll(actor, row.permissions.filter(isCustomRolePermission))) {
    throw new ApiError(403, {
      code: "ROLE_EXCEEDS_YOUR_PERMISSIONS",
      message: "You can't give a role with permissions you don't have.",
    });
  }
}
