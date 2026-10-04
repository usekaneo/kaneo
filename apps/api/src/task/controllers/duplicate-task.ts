import { createId } from "@paralleldrive/cuid2";
import { and, eq, isNotNull } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import {
  assetTable,
  columnTable,
  customFieldDefinitionTable,
  customFieldValueTable,
  labelTable,
  projectTable,
  taskRelationTable,
  taskTable,
  userTable,
} from "../../database/schema";
import { publishEvent } from "../../events";
import { contentReferencesAsset } from "../../storage/cleanup-assets";
import { copyTaskAssetObject, deleteS3Object } from "../../storage/s3";
import {
  assertAssignableUser,
  filterAssignableUsers,
} from "../../utils/assert-assignable-user";
import { taskIsCompleted } from "../task-is-completed";
import {
  assertRequiredCustomFields,
  assertValidTaskStatus,
} from "../validate-task-fields";
import { claimTaskNumber } from "./claim-task-numbers";
import { nextTaskPosition } from "./next-task-position";

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
    .where(
      and(
        eq(assetTable.taskId, sourceTask.id),
        eq(assetTable.projectId, sourceTask.projectId),
        eq(assetTable.workspaceId, workspaceId),
      ),
    );

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

    console.error("Failed to copy task attachments:", error);
    throw new HTTPException(503, {
      message: "Failed to copy the task attachments",
    });
  }

  return { assets, description: duplicatedDescription };
}

type DuplicateTaskOptions = {
  taskId: string;
  currentUserId: string;
  canUpdateTasks: boolean;
  title?: string;
};

// The next occurrence of a recurring task: a copy in a new status and dates that
// takes over the completed task's recurrence rule.
type Occurrence = {
  status: string;
  startDate: Date | null;
  dueDate: Date | null;
};

// Rolls back an occurrence whose rule another transaction already moved.
class RuleAlreadyMovedError extends Error {}

type DuplicatedTask = typeof taskTable.$inferSelect & {
  assigneeName: string | undefined;
};

function duplicateTask(options: DuplicateTaskOptions): Promise<DuplicatedTask>;
// Resolves to null when the source no longer holds a rule to hand over: it was
// reopened, or a concurrent completion already created the next occurrence.
function duplicateTask(
  options: DuplicateTaskOptions & { occurrence: Occurrence },
): Promise<DuplicatedTask | null>;
async function duplicateTask({
  taskId,
  currentUserId,
  canUpdateTasks,
  title,
  occurrence,
}: DuplicateTaskOptions & {
  occurrence?: Occurrence;
}): Promise<DuplicatedTask | null> {
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

  const status = occurrence?.status ?? sourceTask.status;
  await assertValidTaskStatus(status, sourceTask.projectId);
  // A manual copy reports a departed assignee; an occurrence goes unassigned
  // so the series keeps going.
  let userId = sourceTask.userId;
  if (userId && occurrence) {
    const assignable = await filterAssignableUsers(
      [userId],
      project.workspaceId,
    );
    if (!assignable.has(userId)) userId = null;
  } else if (userId) {
    await assertAssignableUser(userId, project.workspaceId);
  }
  const column = await db.query.columnTable.findFirst({
    where: and(
      eq(columnTable.projectId, sourceTask.projectId),
      eq(columnTable.slug, status),
    ),
  });

  const fieldDefinitions = await db
    .select()
    .from(customFieldDefinitionTable)
    .where(eq(customFieldDefinitionTable.projectId, sourceTask.projectId));
  const sourceCustomFields = await db
    .select({
      fieldId: customFieldValueTable.fieldId,
      value: customFieldValueTable.value,
    })
    .from(customFieldValueTable)
    .innerJoin(
      customFieldDefinitionTable,
      eq(customFieldValueTable.fieldId, customFieldDefinitionTable.id),
    )
    .where(
      and(
        eq(customFieldValueTable.taskId, sourceTask.id),
        eq(customFieldDefinitionTable.projectId, sourceTask.projectId),
      ),
    );
  const customFields = sourceCustomFields.map(({ fieldId, value }) => ({
    fieldId,
    value: value ?? "",
  }));
  // Older tasks may predate a required field. Apply its current default or fail
  // validation, just as creation does, before copying anything in storage.
  for (const definition of fieldDefinitions) {
    if (!definition.required || !definition.defaultValue?.trim()) continue;
    const existing = customFields.find(
      (field) => field.fieldId === definition.id,
    );
    if (!existing)
      customFields.push({
        fieldId: definition.id,
        value: definition.defaultValue.trim(),
      });
    else if (!existing.value.trim())
      existing.value = definition.defaultValue.trim();
  }
  await assertRequiredCustomFields(sourceTask.projectId, customFields);

  const sourceLabels = await db
    .select({
      name: labelTable.name,
      color: labelTable.color,
      workspaceId: labelTable.workspaceId,
    })
    .from(labelTable)
    .where(
      and(
        eq(labelTable.taskId, sourceTask.id),
        eq(labelTable.workspaceId, project.workspaceId),
      ),
    );

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
    .innerJoin(projectTable, eq(taskTable.projectId, projectTable.id))
    .where(
      and(
        eq(taskRelationTable.targetTaskId, sourceTask.id),
        eq(projectTable.workspaceId, project.workspaceId),
        eq(taskRelationTable.relationType, "subtask"),
      ),
    );

  if (parentRelations.length > 0 && !canUpdateTasks) {
    throw new HTTPException(403, {
      message: "Duplicating parent links requires task:update permission",
    });
  }

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
      // Locks the project row before the task row, the same order task updates
      // use.
      const taskNumber = await claimTaskNumber(sourceTask.projectId, tx);

      // Moving the rule off the completed task is the claim. The row lock makes
      // a concurrent claim wait and then see no rule, so each completion
      // creates one next task.
      let recurrence: (typeof taskTable.$inferSelect)["recurrence"] = null;
      if (occurrence) {
        const [claimed] = await tx
          .select({ recurrence: taskTable.recurrence })
          .from(taskTable)
          .where(
            and(
              eq(taskTable.id, sourceTask.id),
              isNotNull(taskTable.recurrence),
              taskIsCompleted,
            ),
          )
          .for("update");
        if (!claimed) throw new RuleAlreadyMovedError();
        recurrence = claimed.recurrence;
        await tx
          .update(taskTable)
          .set({ recurrence: null })
          .where(eq(taskTable.id, sourceTask.id));
      }

      const nextPosition = await nextTaskPosition(
        tx,
        sourceTask.projectId,
        status,
        column?.id ?? null,
      );

      const [task] = await tx
        .insert(taskTable)
        .values({
          id: duplicatedTaskId,
          projectId: sourceTask.projectId,
          userId,
          title: title?.trim() || sourceTask.title,
          status,
          columnId: column?.id ?? null,
          startDate: occurrence ? occurrence.startDate : sourceTask.startDate,
          dueDate: occurrence ? occurrence.dueDate : sourceTask.dueDate,
          recurrence,
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

      if (customFields.length > 0) {
        await tx
          .insert(customFieldValueTable)
          .values(customFields.map((field) => ({ ...field, taskId: task.id })));
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
    if (error instanceof RuleAlreadyMovedError) return null;
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
