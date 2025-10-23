import { eq } from "drizzle-orm";
import db from "../../database";
import { labelTable } from "../../database/schema";

function getLabelsByWorkspaceId(workspaceId: string) {
  return db
    .select()
    .from(labelTable)
    .where(eq(labelTable.workspaceId, workspaceId));
}

export default getLabelsByWorkspaceId;
