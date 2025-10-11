import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { taskTable } from "../../database/schema";

async function updateTaskAssignee({
  id,
  userId,
}: {
  id: string;
  userId: string;
}) {
  const updatedTask = await db.query.taskTable.findFirst({
    where: eq(taskTable.id, id),
  });

  if (!updatedTask) {
    throw new HTTPException(404, {
      message: "Task not found",
    });
  }

  await db
    .update(taskTable)
    .set({ userId: userId || null })
    .where(eq(taskTable.id, id));

  if (!updatedTask) {
    throw new HTTPException(404, {
      message: "Task not found",
    });
  }

  return updatedTask;
}

export default updateTaskAssignee;
