import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { taskTable } from "../../database/schema";
import { assertTaskWritable } from "../../utils/assert-task-writable";

async function updateTaskPriority({
  id,
  priority,
}: {
  id: string;
  priority: string;
}) {
  await assertTaskWritable(id);

  const updatedTask = await db.query.taskTable.findFirst({
    where: eq(taskTable.id, id),
  });

  if (!updatedTask) {
    throw new HTTPException(404, {
      message: "Task not found",
    });
  }

  await db.update(taskTable).set({ priority }).where(eq(taskTable.id, id));

  if (!updatedTask) {
    throw new HTTPException(404, {
      message: "Task not found",
    });
  }

  return updatedTask;
}

export default updateTaskPriority;
