import { and, eq } from "drizzle-orm";
import db, { schema } from "../../../../apps/api/src/database";

export async function readMemberAccessRows(
  workspaceId: string,
  userId: string,
) {
  const rules = await db
    .select()
    .from(schema.workspaceMemberAccessTable)
    .where(
      and(
        eq(schema.workspaceMemberAccessTable.workspaceId, workspaceId),
        eq(schema.workspaceMemberAccessTable.userId, userId),
      ),
    );
  const grants = await db
    .select()
    .from(schema.workspaceMemberProjectTable)
    .where(
      and(
        eq(schema.workspaceMemberProjectTable.workspaceId, workspaceId),
        eq(schema.workspaceMemberProjectTable.userId, userId),
      ),
    );
  return { rules, grants };
}
