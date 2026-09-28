import { and, eq, isNull } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { externalLinkTable, taskTable } from "../../database/schema";
import { publishEvent } from "../../events";

export default async function deleteExternalLink({
  taskId,
  id,
  userId,
}: {
  taskId: string;
  id: string;
  userId: string;
}) {
  const task = await db.query.taskTable.findFirst({
    where: eq(taskTable.id, taskId),
    columns: { projectId: true, title: true, status: true },
  });
  if (!task) throw new HTTPException(404, { message: "Task not found" });

  // Bind deletion to the authorized task and leave provider-managed links intact.
  const [deleted] = await db
    .delete(externalLinkTable)
    .where(
      and(
        eq(externalLinkTable.id, id),
        eq(externalLinkTable.taskId, taskId),
        isNull(externalLinkTable.integrationId),
        eq(externalLinkTable.resourceType, "url"),
      ),
    )
    .returning({ id: externalLinkTable.id });
  if (!deleted)
    throw new HTTPException(404, { message: "Manual resource link not found" });

  await publishEvent("task.updated", { taskId, ...task, userId });
  return deleted;
}
