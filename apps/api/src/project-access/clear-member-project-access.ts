import { and, eq } from "drizzle-orm";
import db, { schema } from "../database";
import type { DbOrTx } from "./db-or-tx";

export async function clearMemberProjectAccess(
  workspaceId: string,
  userId: string,
  database: DbOrTx = db,
): Promise<void> {
  await database
    .delete(schema.workspaceMemberProjectTable)
    .where(
      and(
        eq(schema.workspaceMemberProjectTable.workspaceId, workspaceId),
        eq(schema.workspaceMemberProjectTable.userId, userId),
      ),
    );
  await database
    .delete(schema.workspaceMemberAccessTable)
    .where(
      and(
        eq(schema.workspaceMemberAccessTable.workspaceId, workspaceId),
        eq(schema.workspaceMemberAccessTable.userId, userId),
      ),
    );
}
