import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { taskTable } from "../../database/schema";

async function updateTaskDueDate({
  id,
  dueDate,
}: {
  id: string;
  dueDate: Date;
}) {
  const updatedTask = await db.query.taskTable.findFirst({
    where: eq(taskTable.id, id),
  });

  if (!updatedTask) {
    throw new HTTPException(404, {
      message: "Task not found",
    });
  }

  await db.update(taskTable).set({ dueDate }).where(eq(taskTable.id, id));

  if (!updatedTask) {
    throw new HTTPException(404, {
      message: "Task not found",
    });
  }

  return updatedTask;
}

export default updateTaskDueDate;
