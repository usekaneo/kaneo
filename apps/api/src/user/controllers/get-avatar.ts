import { eq } from "drizzle-orm";
import db from "../../database";
import { userAvatarTable } from "../../database/schema";

export async function getAvatar(id: string) {
  const [avatar] = await db
    .select({
      id: userAvatarTable.id,
      mimeType: userAvatarTable.mimeType,
      size: userAvatarTable.size,
      data: userAvatarTable.data,
      updatedAt: userAvatarTable.updatedAt,
    })
    .from(userAvatarTable)
    .where(eq(userAvatarTable.id, id))
    .limit(1);

  return avatar ?? null;
}

export default getAvatar;
