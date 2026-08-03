import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { itemTypeTable } from "../../database/schema";
import { rethrowItemTypeKeyConflict } from "../item-type-key-conflict";

type CreateItemTypeInput = {
  workspaceId: string;
  key: string;
  name: string;
  icon?: string;
  description?: string | null;
  position?: number;
};

async function createItemType(input: CreateItemTypeInput) {
  let itemType: typeof itemTypeTable.$inferSelect | undefined;
  try {
    [itemType] = await db
      .insert(itemTypeTable)
      .values({
        workspaceId: input.workspaceId,
        key: input.key,
        name: input.name,
        icon: input.icon,
        description: input.description,
        position: input.position,
      })
      .returning();
  } catch (error) {
    rethrowItemTypeKeyConflict(error);
  }

  if (!itemType) {
    throw new HTTPException(500, { message: "Failed to create item type" });
  }

  return itemType;
}

export default createItemType;
