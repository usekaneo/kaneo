import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { labelTable, projectTable, taskTable } from "../../database/schema";
import {
  removeLabelFromGitea,
  syncLabelToGitea,
} from "../../plugins/gitea/utils/sync-label-to-gitea";
import {
  removeLabelFromGitHub,
  syncLabelToGitHub,
} from "../../plugins/github/utils/sync-label-to-github";

async function assignLabelToTask(id: string, taskId: string) {
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

  const [updatedLabel] = await db
    .update(labelTable)
    .set({ taskId })
    .where(eq(labelTable.id, id))
    .returning();

  if (!updatedLabel) {
    throw new HTTPException(500, {
      message: "Failed to attach label to task",
    });
  }

  if (label.taskId && label.taskId !== taskId) {
    removeLabelFromGitHub(label.taskId, label.name).catch((error) => {
      console.error("Failed to remove label from GitHub:", error);
    });
    removeLabelFromGitea(label.taskId, label.name).catch((error) => {
      console.error("Failed to remove label from Gitea:", error);
    });
  }

  syncLabelToGitHub(taskId, updatedLabel.name, updatedLabel.color).catch(
    (error) => {
      console.error("Failed to sync label to GitHub:", error);
    },
  );
  syncLabelToGitea(taskId, updatedLabel.name, updatedLabel.color).catch(
    (error) => {
      console.error("Failed to sync label to Gitea:", error);
    },
  );

  return updatedLabel;
}

export default assignLabelToTask;
