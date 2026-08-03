import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { itemTypeTable } from "../../database/schema";

async function archiveItemType(id: string) {
  const [itemType] = await db
    .update(itemTypeTable)
    .set({ archivedAt: new Date() })
    .where(eq(itemTypeTable.id, id))
    .returning();

  if (!itemType) {
    throw new HTTPException(404, { message: "Item type not found" });
  }

  return itemType;
}

export default archiveItemType;
