import db from "../../database";
import { labelTable } from "../../database/schema";
import { publishEvent } from "../../events";

async function createLabel(name: string, color: string, taskId: string) {
  const [label] = await db
    .insert(labelTable)
    .values({ name, color, taskId })
    .returning();

  // Publish label changed event for integrations
  await publishEvent("task.labels_changed", {
    taskId,
    userEmail: null,
    labels: await getLabelsByTaskId(taskId),
    title: "Label added",
  });

  return label;
}

async function getLabelsByTaskId(taskId: string) {
  const labels = await db.query.labelTable.findMany({
    where: (label, { eq }) => eq(label.taskId, taskId),
  });
  return labels.map((label) => ({ name: label.name, color: label.color }));
}

export default createLabel;
