import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { labelTable } from "../../database/schema";
import { publishEvent } from "../../events";

async function deleteLabel(id: string) {
  const label = await db.query.labelTable.findFirst({
    where: (label, { eq }) => eq(label.id, id),
  });

  if (!label) {
    throw new HTTPException(404, {
      message: "Label not found",
    });
  }

  const [deletedLabel] = await db
    .delete(labelTable)
    .where(eq(labelTable.id, id))
    .returning();

  // Publish label changed event for integrations
  await publishEvent("task.labels_changed", {
    taskId: label.taskId,
    userEmail: null,
    labels: await getLabelsByTaskId(label.taskId),
    title: "Label removed",
  });

  return deletedLabel;
}

async function getLabelsByTaskId(taskId: string) {
  const labels = await db.query.labelTable.findMany({
    where: (label, { eq }) => eq(label.taskId, taskId),
  });
  return labels.map((label) => ({ name: label.name, color: label.color }));
}

export default deleteLabel;
