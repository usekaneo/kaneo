import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { commentTable } from "../../database/schema";

async function createComment(taskId: string, userId: string, content: string) {
  const [comment] = await db
    .insert(commentTable)
    .values({
      taskId,
      userId,
      content,
    })
    .returning();

  if (!comment) {
    throw new HTTPException(500, { message: "Failed to create comment" });
  }

  return comment;
}

export default createComment;
