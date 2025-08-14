import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { labelTable, taskLabelTable } from "../../database/schema";

async function createLabel(name: string, color: string, taskId: string) {
  const task = await db.query.taskTable.findFirst({
    where: (t, { eq }) => eq(t.id, taskId),
    with: { project: true },
  });

  if (!task?.project) {
    throw new HTTPException(404, { message: "Task not found" });
  }

  const [label] = await db
    .insert(labelTable)
    .values({
      name,
      color,
      workspaceId: task.project.workspaceId,
    })
    .returning();

  await db.insert(taskLabelTable).values({ taskId, labelId: label.id });

  return label;
}

export default createLabel;
