import { and, eq, isNotNull } from "drizzle-orm";
import db, { schema } from "../../database";
import type { DbOrTx } from "../../project-access/db-or-tx";

/** Storage objects (uploads and project backgrounds) owned by a workspace. */
export async function listWorkspaceObjectKeys(
  workspaceId: string,
  database: DbOrTx = db,
) {
  // Sequential: a transaction's connection runs one query at a time.
  const assets = await database
    .select({ objectKey: schema.assetTable.objectKey })
    .from(schema.assetTable)
    .where(eq(schema.assetTable.workspaceId, workspaceId));
  const backgrounds = await database
    .select({ objectKey: schema.projectTable.backgroundObjectKey })
    .from(schema.projectTable)
    .where(
      and(
        eq(schema.projectTable.workspaceId, workspaceId),
        isNotNull(schema.projectTable.backgroundObjectKey),
      ),
    );
  return [...assets, ...backgrounds].flatMap((row) =>
    row.objectKey ? [row.objectKey] : [],
  );
}
