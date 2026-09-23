import { eq } from "drizzle-orm";
import db from "../../database";
import { userAvatarTable } from "../../database/schema";

export async function deleteAvatar(userId: string) {
  const deleted = await db
    .delete(userAvatarTable)
    .where(eq(userAvatarTable.userId, userId))
    .returning({ id: userAvatarTable.id });

  return { deleted: deleted.length > 0 };
}

export default deleteAvatar;
