import { schema } from "../database";
import type { DbOrTx } from "./db-or-tx";
import { getMemberProjectAccess } from "./get-member-project-access";

export async function grantProjectToRestrictedMember(
  database: DbOrTx,
  grant: { workspaceId: string; userId: string; projectId: string },
): Promise<void> {
  const access = await getMemberProjectAccess(
    grant.workspaceId,
    grant.userId,
    database,
  );
  if (access.projectAccess === "all") return;

  await database
    .insert(schema.workspaceMemberProjectTable)
    .values(grant)
    .onConflictDoNothing();
}
