import { and, asc, eq, inArray, isNull, max, sql } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../database";
import {
  taskChecklistTable,
  taskRelationTable,
  taskTable,
} from "../database/schema";
import { publishEvent } from "../events";
import deleteTask from "../task/controllers/delete-task";

/*
 * Checklists group a task's subtasks. The items are still ordinary tasks
 * linked by `task_relation` rows of type "subtask"; a checklist only adds a
 * name and an order. Subtasks created without a checklist (older data, the
 * API, MCP) are put into the task's first checklist the next time the task's
 * checklists are read.
 */

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

async function projectOf(taskId: string) {
  const [task] = await db
    .select({ projectId: taskTable.projectId })
    .from(taskTable)
    .where(eq(taskTable.id, taskId));
  if (!task) throw new HTTPException(404, { message: "Task not found" });
  return task.projectId;
}

async function changed(taskId: string, userId: string) {
  await publishEvent("checklist.updated", {
    taskId,
    sourceTaskId: taskId,
    projectId: await projectOf(taskId),
    userId,
  });
}

async function findChecklist(taskId: string, id: string) {
  const [checklist] = await db
    .select()
    .from(taskChecklistTable)
    .where(
      and(eq(taskChecklistTable.id, id), eq(taskChecklistTable.taskId, taskId)),
    );
  if (!checklist) {
    throw new HTTPException(404, { message: "Checklist not found" });
  }
  return checklist;
}

/** Puts subtasks that aren't in a checklist yet into the first one. */
async function adoptLooseSubtasks(tx: Tx, taskId: string) {
  const loose = await tx
    .select({ id: taskRelationTable.id })
    .from(taskRelationTable)
    .where(
      and(
        eq(taskRelationTable.sourceTaskId, taskId),
        eq(taskRelationTable.relationType, "subtask"),
        isNull(taskRelationTable.checklistId),
      ),
    )
    .orderBy(asc(taskRelationTable.createdAt));
  if (loose.length === 0) return;

  let [first] = await tx
    .select({ id: taskChecklistTable.id })
    .from(taskChecklistTable)
    .where(eq(taskChecklistTable.taskId, taskId))
    .orderBy(
      asc(taskChecklistTable.position),
      asc(taskChecklistTable.createdAt),
    )
    .limit(1);
  if (!first) {
    [first] = await tx
      .insert(taskChecklistTable)
      .values({ taskId, title: null, position: 0 })
      .returning({ id: taskChecklistTable.id });
  }
  if (!first) return;

  const [{ top } = { top: null }] = await tx
    .select({ top: max(taskRelationTable.position) })
    .from(taskRelationTable)
    .where(eq(taskRelationTable.checklistId, first.id));
  const start = (top ?? -1) + 1;
  for (const [index, relation] of loose.entries()) {
    await tx
      .update(taskRelationTable)
      .set({ checklistId: first.id, position: start + index })
      .where(eq(taskRelationTable.id, relation.id));
  }
}

export async function listChecklists(taskId: string) {
  return db.transaction(async (tx) => {
    // Two readers adopting at once would each create a first checklist.
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtext(${`task-checklists:${taskId}`}))`,
    );
    await adoptLooseSubtasks(tx, taskId);
    return tx
      .select({
        id: taskChecklistTable.id,
        taskId: taskChecklistTable.taskId,
        title: taskChecklistTable.title,
        position: taskChecklistTable.position,
        createdAt: taskChecklistTable.createdAt,
      })
      .from(taskChecklistTable)
      .where(eq(taskChecklistTable.taskId, taskId))
      .orderBy(
        asc(taskChecklistTable.position),
        asc(taskChecklistTable.createdAt),
      );
  });
}

export async function createChecklist(
  taskId: string,
  userId: string,
  title: string | undefined,
) {
  const [{ top } = { top: null }] = await db
    .select({ top: max(taskChecklistTable.position) })
    .from(taskChecklistTable)
    .where(eq(taskChecklistTable.taskId, taskId));
  const [created] = await db
    .insert(taskChecklistTable)
    .values({ taskId, title: title?.trim() || null, position: (top ?? -1) + 1 })
    .returning();
  if (!created) throw new HTTPException(500, { message: "Not created" });
  await changed(taskId, userId);
  return created;
}

export async function renameChecklist(
  taskId: string,
  id: string,
  userId: string,
  title: string,
) {
  await findChecklist(taskId, id);
  const [updated] = await db
    .update(taskChecklistTable)
    .set({ title: title.trim() || null })
    .where(eq(taskChecklistTable.id, id))
    .returning();
  if (!updated)
    throw new HTTPException(404, { message: "Checklist not found" });
  await changed(taskId, userId);
  return updated;
}

/** The items' task ids, so the caller can check it may delete them. */
export async function checklistItemTaskIds(taskId: string, id: string) {
  await findChecklist(taskId, id);
  const rows = await db
    .select({ taskId: taskRelationTable.targetTaskId })
    .from(taskRelationTable)
    .where(eq(taskRelationTable.checklistId, id));
  return rows.map((r) => r.taskId);
}

/** Deletes the checklist and its items (the subtasks themselves). */
export async function deleteChecklist(
  taskId: string,
  id: string,
  userId: string,
) {
  const itemTaskIds = await checklistItemTaskIds(taskId, id);
  // Through deleteTask so each removal is announced and its files cleaned up.
  for (const itemTaskId of itemTaskIds) {
    await deleteTask(itemTaskId, userId);
  }
  await db.delete(taskChecklistTable).where(eq(taskChecklistTable.id, id));
  await changed(taskId, userId);
  return { id, deletedItems: itemTaskIds.length };
}

export async function reorderChecklists(
  taskId: string,
  userId: string,
  ids: string[],
) {
  const owned = await db
    .select({ id: taskChecklistTable.id })
    .from(taskChecklistTable)
    .where(
      and(
        eq(taskChecklistTable.taskId, taskId),
        inArray(taskChecklistTable.id, ids),
      ),
    );
  if (owned.length !== new Set(ids).size) {
    throw new HTTPException(400, {
      message: "Every checklist must belong to this task",
    });
  }
  await db.transaction(async (tx) => {
    for (const [position, id] of ids.entries()) {
      await tx
        .update(taskChecklistTable)
        .set({ position })
        .where(eq(taskChecklistTable.id, id));
    }
  });
  await changed(taskId, userId);
  return listChecklists(taskId);
}

/**
 * Sets the full order of one checklist. Items listed from another checklist
 * of the same task move into this one.
 */
export async function setChecklistItems(
  taskId: string,
  checklistId: string,
  userId: string,
  relationIds: string[],
) {
  await findChecklist(taskId, checklistId);
  const owned = await db
    .select({ id: taskRelationTable.id })
    .from(taskRelationTable)
    .where(
      and(
        eq(taskRelationTable.sourceTaskId, taskId),
        eq(taskRelationTable.relationType, "subtask"),
        inArray(taskRelationTable.id, relationIds),
      ),
    );
  if (owned.length !== new Set(relationIds).size) {
    throw new HTTPException(400, {
      message: "Every item must be a subtask of this task",
    });
  }
  await db.transaction(async (tx) => {
    for (const [position, id] of relationIds.entries()) {
      await tx
        .update(taskRelationTable)
        .set({ checklistId, position })
        .where(eq(taskRelationTable.id, id));
    }
  });
  await changed(taskId, userId);
  return { id: checklistId };
}

/** Where a new subtask goes: the end of the chosen (or first) checklist. */
export async function placeNewSubtask(
  parentTaskId: string,
  relationId: string,
  checklistId: string | undefined,
) {
  if (checklistId) await findChecklist(parentTaskId, checklistId);
  await db.transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtext(${`task-checklists:${parentTaskId}`}))`,
    );
    if (!checklistId) {
      // Unplaced subtasks are adopted into the first checklist.
      await adoptLooseSubtasks(tx, parentTaskId);
      return;
    }
    const [{ top } = { top: null }] = await tx
      .select({ top: max(taskRelationTable.position) })
      .from(taskRelationTable)
      .where(eq(taskRelationTable.checklistId, checklistId));
    await tx
      .update(taskRelationTable)
      .set({ checklistId, position: (top ?? -1) + 1 })
      .where(eq(taskRelationTable.id, relationId));
  });
}
