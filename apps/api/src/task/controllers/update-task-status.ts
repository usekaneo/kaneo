import { and, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { columnTable, taskTable } from "../../database/schema";

async function updateTaskStatus({
  id,
  status,
}: {
  id: string;
  status: string;
}) {
  const updatedTask = await db.query.taskTable.findFirst({
    where: eq(taskTable.id, id),
  });

  if (!updatedTask) {
    throw new HTTPException(404, {
      message: "Task not found",
    });
  }

  const column = await db.query.columnTable.findFirst({
    where: and(
      eq(columnTable.projectId, updatedTask.projectId),
      eq(columnTable.slug, status),
    ),
  });

  await db
    .update(taskTable)
    .set({ status, columnId: column?.id ?? null })
    .where(eq(taskTable.id, id));

  return updatedTask;
}

export default updateTaskStatus;
