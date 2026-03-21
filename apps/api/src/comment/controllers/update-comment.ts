import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { commentTable } from "../../database/schema";

async function updateComment(userId: string, id: string, content: string) {
  const [existing] = await db
    .select({ userId: commentTable.userId })
    .from(commentTable)
    .where(eq(commentTable.id, id))
    .limit(1);

  if (!existing) {
    throw new HTTPException(404, { message: "Comment not found" });
  }

  if (existing.userId !== userId) {
    throw new HTTPException(403, {
      message: "Only the author can edit this comment",
    });
  }

  const [updated] = await db
    .update(commentTable)
    .set({ content })
    .where(eq(commentTable.id, id))
    .returning();

  if (!updated) {
    throw new HTTPException(500, { message: "Failed to update comment" });
  }

  return updated;
}

export default updateComment;
