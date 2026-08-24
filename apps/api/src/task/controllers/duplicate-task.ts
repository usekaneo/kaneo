import { createId } from "@paralleldrive/cuid2";
import { and, eq, max } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import {
  assetTable,
  labelTable,
  projectTable,
  taskRelationTable,
  taskTable,
  userTable,
} from "../../database/schema";
import { publishEvent } from "../../events";
import { contentReferencesAsset } from "../../storage/cleanup-assets";
import { copyTaskAssetObject, deleteS3Object } from "../../storage/s3";
import { claimTaskNumber } from "./claim-task-numbers";

async function discardCopiedObjects(objectKeys: string[]) {
  await Promise.all(
    objectKeys.map((objectKey) =>
      deleteS3Object(objectKey).catch((error) => {
        console.error("Failed to discard a duplicated task asset:", error);
      }),
    ),
  );
}

// Assets are addressed by `/api/asset/<id>` inside the description, so the copy
// needs its own asset rows and stored objects. Sharing the source rows is not an
// option: `asset.objectKey` is unique and deleting the source task cascades to them.
async function duplicateDescriptionAssets({
  sourceTask,
  duplicatedTaskId,
  workspaceId,
}: {
  sourceTask: typeof taskTable.$inferSelect;
  duplicatedTaskId: string;
  workspaceId: string;
}) {
  const description = sourceTask.description;

  if (!description) {
    return { assets: [], description };
  }

  const sourceAssets = await db
    .select()
    .from(assetTable)
    .where(eq(assetTable.taskId, sourceTask.id));

  const referencedAssets = sourceAssets.filter((asset) =>
    contentReferencesAsset(description, asset.id),
  );

  const assets: (typeof assetTable.$inferInsert)[] = [];
  let duplicatedDescription = description;

  try {
    for (const asset of referencedAssets) {
      const duplicatedAssetId = createId();
      const objectKey = await copyTaskAssetObject({
        sourceKey: asset.objectKey,
        destination: {
          workspaceId,
          projectId: sourceTask.projectId,
          taskId: duplicatedTaskId,
          surface: asset.surface === "comment" ? "comment" : "description",
          filename: asset.filename,
          contentType: asset.mimeType,
        },
      });

      assets.push({
        id: duplicatedAssetId,
        workspaceId,
        projectId: sourceTask.projectId,
        taskId: duplicatedTaskId,
        objectKey,
        filename: asset.filename,
        mimeType: asset.mimeType,
        size: asset.size,
        kind: asset.kind,
        surface: asset.surface,
        createdBy: asset.createdBy,
      });

      duplicatedDescription = duplicatedDescription.replaceAll(
        `/api/asset/${asset.id}`,
        `/api/asset/${duplicatedAssetId}`,
      );
    }
  } catch (error) {
    await discardCopiedObjects(assets.map((asset) => asset.objectKey));

    throw new HTTPException(503, {
      message:
        error instanceof Error
          ? error.message
          : "Failed to copy the task attachments",
    });
  }

  return { assets, description: duplicatedDescription };
}

async function duplicateTask({
  taskId,
  currentUserId,
  title,
}: {
  taskId: string;
  currentUserId: string;
  title?: string;
}) {
  const sourceTask = await db.query.taskTable.findFirst({
    where: eq(taskTable.id, taskId),
  });

  if (!sourceTask) {
    throw new HTTPException(404, {
      message: "Task not found",
    });
  }

  const [project] = await db
    .select({ workspaceId: projectTable.workspaceId })
    .from(projectTable)
    .where(eq(projectTable.id, sourceTask.projectId))
    .limit(1);

  if (!project) {
    throw new HTTPException(404, {
      message: "Project not found",
    });
  }

  const [maxPositionResult] = await db
    .select({ maxPosition: max(taskTable.position) })
    .from(taskTable)
    .where(
      and(
        eq(taskTable.projectId, sourceTask.projectId),
        sourceTask.columnId
          ? eq(taskTable.columnId, sourceTask.columnId)
          : eq(taskTable.status, sourceTask.status),
      ),
    );

  const nextPosition = (maxPositionResult?.maxPosition ?? 0) + 1;

  const sourceLabels = await db
    .select({
      name: labelTable.name,
      color: labelTable.color,
      workspaceId: labelTable.workspaceId,
    })
    .from(labelTable)
    .where(eq(labelTable.taskId, sourceTask.id));

  // A duplicated subtask stays a subtask of the same parents. The source's own
  // subtasks are not duplicated: a copy is one task, not a tree.
  const parentRelations = await db
    .select({
      parentTaskId: taskRelationTable.sourceTaskId,
      parentProjectId: taskTable.projectId,
      relationType: taskRelationTable.relationType,
    })
    .from(taskRelationTable)
    .innerJoin(taskTable, eq(taskRelationTable.sourceTaskId, taskTable.id))
    .where(
      and(
        eq(taskRelationTable.targetTaskId, sourceTask.id),
        eq(taskRelationTable.relationType, "subtask"),
      ),
    );

  // The destination object keys embed the new task id, so it is generated up front
  // instead of being left to the insert.
  const duplicatedTaskId = createId();

  const { assets, description } = await duplicateDescriptionAssets({
    sourceTask,
    duplicatedTaskId,
    workspaceId: project.workspaceId,
  });

  let duplicated: {
    task: typeof taskTable.$inferSelect;
    relations: (typeof taskRelationTable.$inferSelect)[];
  };

  try {
    duplicated = await db.transaction(async (tx) => {
      const taskNumber = await claimTaskNumber(sourceTask.projectId, tx);

      const [task] = await tx
        .insert(taskTable)
        .values({
          id: duplicatedTaskId,
          projectId: sourceTask.projectId,
          userId: sourceTask.userId,
          title: title?.trim() || sourceTask.title,
          status: sourceTask.status,
          columnId: sourceTask.columnId,
          startDate: sourceTask.startDate,
          dueDate: sourceTask.dueDate,
          description,
          priority: sourceTask.priority,
          number: taskNumber,
          position: nextPosition,
        })
        .returning();

      if (!task) {
        throw new HTTPException(500, {
          message: "Failed to duplicate task",
        });
      }

      if (sourceLabels.length > 0) {
        await tx.insert(labelTable).values(
          sourceLabels.map((label) => ({
            name: label.name,
            color: label.color,
            taskId: task.id,
            workspaceId: label.workspaceId,
          })),
        );
      }

      if (assets.length > 0) {
        await tx.insert(assetTable).values(assets);
      }

      const relations =
        parentRelations.length > 0
          ? await tx
              .insert(taskRelationTable)
              .values(
                parentRelations.map((relation) => ({
                  sourceTaskId: relation.parentTaskId,
                  targetTaskId: task.id,
                  relationType: relation.relationType,
                })),
              )
              .returning()
          : [];

      return { task, relations };
    });
  } catch (error) {
    await discardCopiedObjects(assets.map((asset) => asset.objectKey));
    throw error;
  }

  const duplicatedTask = duplicated.task;

  const [assignee] = duplicatedTask.userId
    ? await db
        .select({ name: userTable.name })
        .from(userTable)
        .where(eq(userTable.id, duplicatedTask.userId))
    : [];

  await publishEvent("task.created", {
    ...duplicatedTask,
    taskId: duplicatedTask.id,
    userId: duplicatedTask.userId ?? "",
    currentUserId,
    type: "created",
    content: null,
  });

  for (const relation of duplicated.relations) {
    const parentProjectId = parentRelations.find(
      (parentRelation) => parentRelation.parentTaskId === relation.sourceTaskId,
    )?.parentProjectId;

    await publishEvent("task-relation.created", {
      ...relation,
      taskId: relation.sourceTaskId,
      projectId: parentProjectId ?? sourceTask.projectId,
      userId: currentUserId,
    });
  }

  return {
    ...duplicatedTask,
    assigneeName: assignee?.name,
  };
}

export default duplicateTask;
