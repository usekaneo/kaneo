import type { CustomRolePermission } from "@kaneo/permissions";
import db from "../../database";
import { instanceRoleTable } from "../../database/schema";
import type { AdminAuditRequest } from "../audit/admin-audit-request";
import { recordAdminAction } from "../audit/record-admin-action";
import { assertRoleNameAvailable } from "../roles/assert-role-name-available";
import { findInstanceRole } from "../roles/find-instance-role";

type CreateInstanceRoleInput = {
  name: string;
  permissions: CustomRolePermission[];
};

async function createInstanceRole(
  input: CreateInstanceRoleInput,
  audit: AdminAuditRequest,
) {
  return db.transaction(async (tx) => {
    await assertRoleNameAvailable(input.name, tx);
    const [created] = await tx
      .insert(instanceRoleTable)
      .values(input)
      .returning({ id: instanceRoleTable.id });
    if (!created) throw new Error("Instance role was not created");

    await recordAdminAction(
      {
        ...audit,
        action: "role.created",
        targetType: "role",
        targetId: created.id,
        targetLabel: input.name,
        metadata: { permissions: input.permissions },
      },
      tx,
    );
    const role = await findInstanceRole(created.id, tx);
    if (!role) throw new Error("Instance role was not created");
    return role;
  });
}

export default createInstanceRole;
