import { and, eq, inArray, or } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import {
  projectTable,
  taskRelationTable,
  taskTable,
} from "../../database/schema";
import { publishEvent } from "../../events";
import { deleteS3Keys, getTaskAssetKeys } from "../../storage/cleanup-assets";
import getTask from "./get-task";

async function deleteTask(
  taskId: string,
  currentUserId: string,
  workspaceId: string,
) {
  const task = await getTask(taskId);

  const relations = await db
    .select()
    .from(taskRelationTable)
    .where(
      or(
        eq(taskRelationTable.sourceTaskId, taskId),
        eq(taskRelationTable.targetTaskId, taskId),
      ),
    )
    .execute();

  // A relation can link this task to one in a different project. That other
  // project's own tasks/projectId are looked up up front so the deletion
  // loop below can notify it too, same as the standalone relation-delete
  // endpoint does — otherwise its Gantt/dependency view never learns the
  // relation (and the far end's own row) is gone. The lookup is scoped to
  // the current workspace so a legacy cross-workspace relation row can't
  // leak an event onto a foreign workspace's project channel; a far-end
  // task in another workspace is simply not found.
  const otherTaskIds = [
    ...new Set(
      relations.map((relation) =>
        relation.sourceTaskId === taskId
          ? relation.targetTaskId
          : relation.sourceTaskId,
      ),
    ),
  ];
  const otherProjectIdByTaskId = new Map<string, string>();
  if (otherTaskIds.length > 0) {
    const otherTasks = await db
      .select({ id: taskTable.id, projectId: taskTable.projectId })
      .from(taskTable)
      .innerJoin(projectTable, eq(taskTable.projectId, projectTable.id))
      .where(
        and(
          inArray(taskTable.id, otherTaskIds),
          eq(projectTable.workspaceId, workspaceId),
        ),
      );
    for (const otherTask of otherTasks) {
      otherProjectIdByTaskId.set(otherTask.id, otherTask.projectId);
    }
  }

  const assetKeys = await getTaskAssetKeys(taskId);

  const [deletedTask] = await db
    .delete(taskTable)
    .where(eq(taskTable.id, taskId))
    .returning()
    .execute();

  if (!deletedTask) {
    throw new HTTPException(404, {
      message: "Task not found",
    });
  }

  await publishEvent("task.deleted", {
    taskId: task.id,
    projectId: task.projectId,
    userId: currentUserId,
    title: task.title,
  });

  for (const relation of relations) {
    await publishEvent("task-relation.deleted", {
      projectId: task.projectId,
      userId: currentUserId,
      taskId: taskId,
      sourceTaskId: relation.sourceTaskId,
      targetTaskId: relation.targetTaskId,
    });

    const otherTaskId =
      relation.sourceTaskId === taskId
        ? relation.targetTaskId
        : relation.sourceTaskId;
    const otherProjectId = otherProjectIdByTaskId.get(otherTaskId);
    if (otherProjectId && otherProjectId !== task.projectId) {
      await publishEvent("task-relation.deleted", {
        projectId: otherProjectId,
        userId: currentUserId,
        taskId: taskId,
        sourceTaskId: relation.sourceTaskId,
        targetTaskId: relation.targetTaskId,
      });
    }
  }

  // Fire-and-forget S3 cleanup after successful DB delete
  if (assetKeys.length > 0) {
    deleteS3Keys(assetKeys).catch(() => {});
  }

  return task;
}

export default deleteTask;
