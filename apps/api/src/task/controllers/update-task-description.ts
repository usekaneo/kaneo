import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { taskTable } from "../../database/schema";
import { assertTaskWritable } from "../../utils/assert-task-writable";

async function updateTaskDescription({
  id,
  description,
}: {
  id: string;
  description: string;
}) {
  await assertTaskWritable(id);

  const existingTask = await db.query.taskTable.findFirst({
    where: eq(taskTable.id, id),
  });

  if (!existingTask) {
    throw new HTTPException(404, {
      message: "Task not found",
    });
  }

  const [updatedTask] = await db
    .update(taskTable)
    .set({ description })
    .where(eq(taskTable.id, id))
    .returning();

  if (!updatedTask) {
    throw new HTTPException(500, {
      message: "Failed to update task description",
    });
  }

  return updatedTask;
}

export default updateTaskDescription;
