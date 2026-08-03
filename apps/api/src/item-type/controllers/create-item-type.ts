import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { itemTypeTable } from "../../database/schema";

type CreateItemTypeInput = {
  workspaceId: string;
  key: string;
  name: string;
  icon?: string;
  description?: string | null;
  position?: number;
};

async function createItemType(input: CreateItemTypeInput) {
  const [itemType] = await db
    .insert(itemTypeTable)
    .values({
      workspaceId: input.workspaceId,
      key: input.key,
      name: input.name,
      icon: input.icon,
      description: input.description,
      position: input.position,
    })
    .onConflictDoNothing({
      target: [itemTypeTable.workspaceId, itemTypeTable.key],
    })
    .returning();

  if (!itemType) {
    throw new HTTPException(409, {
      message: "An item type with this key already exists",
    });
  }

  return itemType;
}

export default createItemType;
