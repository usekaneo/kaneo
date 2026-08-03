import { and, asc, eq, isNull } from "drizzle-orm";
import db from "../../database";
import { itemTypeTable } from "../../database/schema";

function listItemTypes(workspaceId: string) {
  return db
    .select()
    .from(itemTypeTable)
    .where(
      and(
        eq(itemTypeTable.workspaceId, workspaceId),
        isNull(itemTypeTable.archivedAt),
      ),
    )
    .orderBy(asc(itemTypeTable.position), asc(itemTypeTable.name));
}

export default listItemTypes;
