import { and, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { columnTable, projectTable, taskTable } from "../../database/schema";
import { publishEvent } from "../../events";
import { findInaccessibleProjectIds } from "../../project-access/find-inaccessible-project-ids";
import { assertAssignableUser } from "../../utils/assert-assignable-user";
import {
  validateAndParseDate,
  validateDateRange,
} from "../../utils/validate-dates";
import type { z } from "../../openapi";
import type { patchTaskBody } from "../schema";
import { assertValidTaskStatus } from "../validate-task-fields";
import {
  publishTaskMutation,
  recordTaskMutation,
} from "./task-mutation-effects";

function parseDate(value: string | null | undefined, field: string) {
  return typeof value === "string" ? validateAndParseDate(value, field) : value;
}

export async function patchTask(
  id: string,
  workspaceId: string,
  actorId: string,
  input: z.infer<typeof patchTaskBody>,
) {
  const { startDate, dueDate, userId, ...fields } = input;
  const changes = {
    ...fields,
    startDate: parseDate(startDate, "startDate"),
    dueDate: parseDate(dueDate, "dueDate"),
    userId: userId === undefined ? undefined : userId?.trim() || null,
    columnId: undefined as string | null | undefined,
  };

  const { before, after } = await db.transaction(async (tx) => {
    // Lock the project before the task, matching the order used by moves.
    const [project] = await tx
      .select({ id: projectTable.id, workspaceId: projectTable.workspaceId })
      .from(projectTable)
      .innerJoin(taskTable, eq(taskTable.projectId, projectTable.id))
      .where(eq(taskTable.id, id))
      .for("share", { of: projectTable });
    if (!project) throw new HTTPException(404, { message: "Task not found" });
    if (
      project.workspaceId !== workspaceId ||
      (await findInaccessibleProjectIds(actorId, [project.id], tx)).length
    ) {
      throw new HTTPException(403, {
        message: "You don't have access to this project",
      });
    }

    const [before] = await tx
      .select()
      .from(taskTable)
      .where(and(eq(taskTable.id, id), eq(taskTable.projectId, project.id)))
      .for("update");
    if (!before) {
      throw new HTTPException(409, {
        message: "Task changed projects. Try again.",
      });
    }

    if (startDate !== undefined || dueDate !== undefined) {
      validateDateRange(
        changes.startDate === undefined ? before.startDate : changes.startDate,
        changes.dueDate === undefined ? before.dueDate : changes.dueDate,
      );
    }
    if (changes.status !== undefined) {
      await assertValidTaskStatus(changes.status, project.id, tx);
      const column = await tx.query.columnTable.findFirst({
        where: and(
          eq(columnTable.projectId, project.id),
          eq(columnTable.slug, changes.status),
        ),
      });
      changes.columnId = column?.id ?? null;
    }
    if (changes.userId && changes.userId !== before.userId) {
      await assertAssignableUser(changes.userId, workspaceId, project.id, tx);
    }

    const [after] = await tx
      .update(taskTable)
      .set(changes)
      .where(eq(taskTable.id, id))
      .returning();
    if (!after)
      throw new HTTPException(500, { message: "Failed to update task" });
    await recordTaskMutation(tx, before, changes, actorId);
    return { before, after };
  });

  await publishTaskMutation(before, after, actorId, { workspaceId });
  await publishEvent("task.updated", {
    taskId: id,
    projectId: after.projectId,
    title: after.title,
    status: after.status,
    userId: actorId,
  });
  return after;
}
