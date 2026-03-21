import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { commentTable } from "../../database/schema";

async function deleteComment(userId: string, id: string) {
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
      message: "Only the author can delete this comment",
    });
  }

  const [deleted] = await db
    .delete(commentTable)
    .where(eq(commentTable.id, id))
    .returning();

  if (!deleted) {
    throw new HTTPException(500, { message: "Failed to delete comment" });
  }

  return deleted;
}

export default deleteComment;
