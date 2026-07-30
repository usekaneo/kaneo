import { and, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { labelTable, projectTable, taskTable } from "../../database/schema";
import { publishEvent } from "../../events";
import {
  removeLabelFromGitea,
  syncLabelToGitea,
} from "../../plugins/gitea/utils/sync-label-to-gitea";
import {
  removeLabelFromGitHub,
  syncLabelToGitHub,
} from "../../plugins/github/utils/sync-label-to-github";

async function assignLabelToTask(id: string, taskId: string, userId: string) {
  const label = await db.query.labelTable.findFirst({
    where: (label, { eq }) => eq(label.id, id),
  });

  if (!label) {
    throw new HTTPException(404, {
      message: "Label not found",
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
    .where(eq(taskTable.id, taskId))
    .limit(1);

  if (!task) {
    throw new HTTPException(404, {
      message: "Task not found",
    });
  }

  if (label.workspaceId && label.workspaceId !== task.workspaceId) {
    throw new HTTPException(400, {
      message: "Label and task must belong to the same workspace",
    });
  }

  if (label.taskId === taskId) {
    return label;
  }

  if (label.taskId && label.taskId !== taskId) {
    const previousTaskId = label.taskId;
    const previousName = label.name;

    await db.delete(labelTable).where(eq(labelTable.id, id));

    removeLabelFromGitHub(previousTaskId, previousName).catch((error) => {
      console.error("Failed to remove label from GitHub:", error);
    });
    removeLabelFromGitea(previousTaskId, previousName).catch((error) => {
      console.error("Failed to remove label from Gitea:", error);
    });
  }

  const [inserted] = await db
    .insert(labelTable)
    .values({
      name: label.name,
      color: label.color,
      taskId,
      workspaceId: task.workspaceId,
    })
    .onConflictDoNothing({
      target: [labelTable.taskId, labelTable.name],
    })
    .returning();

  const taskLabel =
    inserted ??
    (await db.query.labelTable.findFirst({
      where: and(
        eq(labelTable.taskId, taskId),
        eq(labelTable.name, label.name),
      ),
    }));

  if (!taskLabel) {
    throw new HTTPException(500, {
      message: "Failed to attach label to task",
    });
  }

  syncLabelToGitHub(taskId, taskLabel.name, taskLabel.color).catch((error) => {
    console.error("Failed to sync label to GitHub:", error);
  });
  syncLabelToGitea(taskId, taskLabel.name, taskLabel.color).catch((error) => {
    console.error("Failed to sync label to Gitea:", error);
  });

  await publishEvent("task.label_assigned", {
    label: taskLabel,
    task,
    projectId: task.projectId,
    taskId: task.id,
    userId,
    type: "label_assigned",
  });

  return taskLabel;
}

export default assignLabelToTask;
