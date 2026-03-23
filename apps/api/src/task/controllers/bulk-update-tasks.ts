import { and, eq, inArray } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import {
  columnTable,
  labelTable,
  projectTable,
  taskTable,
  workspaceUserTable,
} from "../../database/schema";

type BulkOperation =
  | "updateStatus"
  | "updatePriority"
  | "updateAssignee"
  | "delete"
  | "addLabel"
  | "removeLabel"
  | "updateDueDate";

async function bulkUpdateTasks({
  taskIds,
  operation,
  value,
  userId,
}: {
  taskIds: string[];
  operation: BulkOperation;
  value?: string | null;
  userId: string;
}) {
  const tasks = await db
    .select({
      id: taskTable.id,
      projectId: taskTable.projectId,
      workspaceId: projectTable.workspaceId,
    })
    .from(taskTable)
    .innerJoin(projectTable, eq(taskTable.projectId, projectTable.id))
    .where(inArray(taskTable.id, taskIds));

  if (tasks.length === 0) {
    throw new HTTPException(404, {
      message: "No tasks found",
    });
  }

  const workspaceIds = [...new Set(tasks.map((t) => t.workspaceId))];

  if (workspaceIds.length > 1) {
    throw new HTTPException(400, {
      message: "All tasks must belong to the same workspace",
    });
  }

  const workspaceId = workspaceIds[0];

  if (!workspaceId) {
    throw new HTTPException(400, {
      message: "Could not determine workspace",
    });
  }

  const [membership] = await db
    .select({ id: workspaceUserTable.id })
    .from(workspaceUserTable)
    .where(
      and(
        eq(workspaceUserTable.userId, userId),
        eq(workspaceUserTable.workspaceId, workspaceId),
      ),
    )
    .limit(1);

  if (!membership) {
    throw new HTTPException(403, {
      message: "You don't have access to this workspace",
    });
  }

  const foundIds = tasks.map((t) => t.id);
  let updatedCount = 0;

  switch (operation) {
    case "updateStatus": {
      if (!value) {
        throw new HTTPException(400, { message: "Status value is required" });
      }
      const projectIds = [...new Set(tasks.map((t) => t.projectId))];

      for (const projectId of projectIds) {
        const column = await db.query.columnTable.findFirst({
          where: and(
            eq(columnTable.projectId, projectId),
            eq(columnTable.slug, value),
          ),
        });

        const projectTaskIds = tasks
          .filter((t) => t.projectId === projectId)
          .map((t) => t.id);

        const result = await db
          .update(taskTable)
          .set({ status: value, columnId: column?.id ?? null })
          .where(inArray(taskTable.id, projectTaskIds));

        updatedCount += result.rowCount ?? projectTaskIds.length;
      }
      break;
    }

    case "updatePriority": {
      if (!value) {
        throw new HTTPException(400, { message: "Priority value is required" });
      }
      const result = await db
        .update(taskTable)
        .set({ priority: value })
        .where(inArray(taskTable.id, foundIds));

      updatedCount = result.rowCount ?? foundIds.length;
      break;
    }

    case "updateAssignee": {
      const result = await db
        .update(taskTable)
        .set({ userId: value || null })
        .where(inArray(taskTable.id, foundIds));

      updatedCount = result.rowCount ?? foundIds.length;
      break;
    }

    case "delete": {
      const result = await db
        .delete(taskTable)
        .where(inArray(taskTable.id, foundIds));

      updatedCount = result.rowCount ?? foundIds.length;
      break;
    }

    case "addLabel": {
      if (!value) {
        throw new HTTPException(400, { message: "Label ID is required" });
      }

      const label = await db.query.labelTable.findFirst({
        where: eq(labelTable.id, value),
      });

      if (!label) {
        throw new HTTPException(404, { message: "Label not found" });
      }

      for (const task of tasks) {
        const existingAssignment = await db.query.labelTable.findFirst({
          where: and(
            eq(labelTable.name, label.name),
            eq(labelTable.color, label.color),
            eq(labelTable.taskId, task.id),
          ),
        });

        if (!existingAssignment) {
          await db.insert(labelTable).values({
            name: label.name,
            color: label.color,
            workspaceId: workspaceId,
            taskId: task.id,
          });
          updatedCount++;
        }
      }
      break;
    }

    case "removeLabel": {
      if (!value) {
        throw new HTTPException(400, { message: "Label ID is required" });
      }
      const result = await db
        .update(labelTable)
        .set({ taskId: null })
        .where(
          and(eq(labelTable.id, value), inArray(labelTable.taskId, foundIds)),
        );

      updatedCount = result.rowCount ?? foundIds.length;
      break;
    }

    case "updateDueDate": {
      const result = await db
        .update(taskTable)
        .set({ dueDate: value ? new Date(value) : null })
        .where(inArray(taskTable.id, foundIds));

      updatedCount = result.rowCount ?? foundIds.length;
      break;
    }
  }

  return { success: true, updatedCount };
}

export default bulkUpdateTasks;
