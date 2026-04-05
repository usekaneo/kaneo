import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { labelTable, projectTable, taskTable } from "../../database/schema";
import { publishEvent } from "../../events";
import { removeLabelFromGitHub } from "../../plugins/github/utils/sync-label-to-github";

async function unassignLabelFromTask(id: string, userId: string) {
  const label = await db.query.labelTable.findFirst({
    where: (label, { eq }) => eq(label.id, id),
  });

  if (!label) {
    throw new HTTPException(404, {
      message: "Label not found",
    });
  }

  if (!label.taskId) {
    throw new HTTPException(400, {
      message: "Label is not assigned to a task",
    });
  }

  const [task] = await db
    .select({
      id: taskTable.id,
      projectId: taskTable.projectId,
      workspaceId: projectTable.workspaceId,
    })
    .from(taskTable)
    .innerJoin(projectTable, eq(taskTable.projectId, projectTable.id))
    .where(eq(taskTable.id, label.taskId))
    .limit(1);

  if (!task) {
    throw new HTTPException(404, {
      message: "Task not found",
    });
  }

  const [updatedLabel] = await db
    .update(labelTable)
    .set({ taskId: null })
    .where(eq(labelTable.id, id))
    .returning();

  if (!updatedLabel) {
    throw new HTTPException(500, {
      message: "Failed to detach label from task",
    });
  }

  if (label.taskId) {
    removeLabelFromGitHub(label.taskId, label.name).catch((error) => {
      console.error("Failed to remove label from GitHub:", error);
    });
  }

  await publishEvent("task.label_unassigned", {
    ...updatedLabel,
    ...task,
    userId: userId,
    type: "label_unassigned",
  });

  return updatedLabel;
}

export default unassignLabelFromTask;
