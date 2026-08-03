import { and, eq, ne } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { itemTypeTable } from "../../database/schema";

type UpdateItemTypeInput = {
  key: string;
  name: string;
  icon: string;
  description: string | null;
  position: number;
};

async function updateItemType(id: string, input: UpdateItemTypeInput) {
  const existing = await db.query.itemTypeTable.findFirst({
    where: eq(itemTypeTable.id, id),
  });

  if (!existing) {
    throw new HTTPException(404, { message: "Item type not found" });
  }

  const duplicate = await db.query.itemTypeTable.findFirst({
    columns: { id: true },
    where: and(
      eq(itemTypeTable.workspaceId, existing.workspaceId),
      eq(itemTypeTable.key, input.key),
      ne(itemTypeTable.id, id),
    ),
  });

  if (duplicate) {
    throw new HTTPException(409, {
      message: "An item type with this key already exists",
    });
  }

  const [itemType] = await db
    .update(itemTypeTable)
    .set(input)
    .where(eq(itemTypeTable.id, id))
    .returning();

  if (!itemType) {
    throw new HTTPException(404, { message: "Item type not found" });
  }

  return itemType;
}

export default updateItemType;
