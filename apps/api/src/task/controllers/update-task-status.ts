import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { taskTable } from "../../database/schema";
import { assertTaskWritable } from "../../utils/assert-task-writable";

async function updateTaskStatus({
  id,
  status,
}: {
  id: string;
  status: string;
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

  await db.update(taskTable).set({ status }).where(eq(taskTable.id, id));

  return updatedTask;
}

export default updateTaskStatus;
