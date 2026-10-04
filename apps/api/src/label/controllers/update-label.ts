import { and, eq, isNotNull, isNull } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { labelTable, projectTable, taskTable } from "../../database/schema";

import { publishEvent } from "../../events";
import { notifySyncWorkspaceLabelChanged } from "../../plugins/sync/workspace-label-changed";

async function updateLabel(id: string, name: string, color: string) {
  const result = await db.transaction(async (tx) => {
    const label = await tx.query.labelTable.findFirst({
      where: (label, { eq }) => eq(label.id, id),
    });

    if (!label) {
      throw new HTTPException(404, {
        message: "Label not found",
      });
    }

    if (label.deletionStartedAt)
      throw new HTTPException(409, {
        message: "This label is being deleted; resume its deletion instead",
      });

    const [updatedLabel] = await tx
      .update(labelTable)
      .set({ name, color })
      .where(and(eq(labelTable.id, id), isNull(labelTable.deletionStartedAt)))
      .returning();

    if (!updatedLabel)
      throw new HTTPException(409, { message: "This label is being deleted" });

    // If this is a workspace-level label, cascade the changes to all
    // task-level copies so existing label assignments reflect the new color/name
    if (!label.taskId && label.workspaceId) {
      await tx
        .update(labelTable)
        .set({ name, color })
        .where(
          and(
            eq(labelTable.workspaceId, label.workspaceId),
            eq(labelTable.name, label.name),
            isNotNull(labelTable.taskId),
          ),
        );
    }

    // Workspace labels appear in every board's choices, including unassigned
    // labels. Publish only project IDs within this workspace after commit.
    const projects =
      !label.taskId && label.workspaceId
        ? await tx
            .select({ projectId: projectTable.id })
            .from(projectTable)
            .where(eq(projectTable.workspaceId, label.workspaceId))
        : await tx
            .selectDistinct({ projectId: taskTable.projectId })
            .from(labelTable)
            .innerJoin(taskTable, eq(labelTable.taskId, taskTable.id))
            .innerJoin(projectTable, eq(taskTable.projectId, projectTable.id))
            .where(
              and(
                label.taskId
                  ? eq(labelTable.id, id)
                  : and(
                      eq(labelTable.workspaceId, label.workspaceId ?? ""),
                      eq(labelTable.name, name),
                    ),
                eq(projectTable.workspaceId, label.workspaceId ?? ""),
              ),
            );
    return { updatedLabel, projects, original: label };
  });
  for (const { projectId } of result.projects) {
    await publishEvent("project.updated", { projectId });
  }
  if (result.original.name !== name) {
    if (!result.original.taskId && result.original.workspaceId)
      await notifySyncWorkspaceLabelChanged(result.original.workspaceId, id, {
        publishProjectUpdates: false,
      });
    else if (result.original.taskId)
      for (const { projectId } of result.projects)
        await publishEvent("task.labels_updated", {
          projectId,
          taskId: result.original.taskId,
        });
  }
  return result.updatedLabel;
}

export default updateLabel;
