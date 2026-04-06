import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { labelTable, projectTable, taskTable } from "../../database/schema";
import { publishEvent } from "../../events";
import { removeLabelFromGitHub } from "../../plugins/github/utils/sync-label-to-github";

async function deleteLabel(id: string, userId: string) {
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
      message: "Label is not associated with a task",
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

  const [deletedLabel] = await db
    .delete(labelTable)
    .where(eq(labelTable.id, id))
    .returning();

  if (!deletedLabel) {
    throw new HTTPException(404, {
      message: "Label not found",
    });
  }

  if (deletedLabel?.taskId) {
    removeLabelFromGitHub(deletedLabel.taskId, deletedLabel.name).catch(
      (error) => {
        console.error("Failed to remove label from GitHub:", error);
      },
    );
  }

  await publishEvent("task.label_deleted", {
    label: deletedLabel,
    task: task,
    projectId: task.projectId,
    taskId: task.id,
    userId: userId,
    type: "label_deleted",
  });

  return deletedLabel;
}

export default deleteLabel;
