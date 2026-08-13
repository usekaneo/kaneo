import { and, eq, inArray, max } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import {
  columnTable,
  taskAssigneeTable,
  taskTable,
  userTable,
} from "../../database/schema";
import { publishEvent } from "../../events";
import { assertValidTaskStatus } from "../validate-task-fields";
import { claimTaskNumber } from "./claim-task-numbers";

async function createTask({
  projectId,
  currentUserId,
  userId,
  assigneeIds,
  title,
  status,
  startDate,
  dueDate,
  description,
  priority,
}: {
  projectId: string;
  currentUserId: string;
  userId?: string;
  assigneeIds?: string[];
  title: string;
  status: string;
  startDate?: Date;
  dueDate?: Date;
  description?: string;
  priority?: string;
}) {
  const resolvedStatus = status || "to-do";
  const resolvedPriority = priority || "no-priority";

  let targetAssigneeIds: string[] = [];
  if (assigneeIds && assigneeIds.length > 0) {
    targetAssigneeIds = Array.from(new Set(assigneeIds.filter(Boolean)));
  } else if (userId?.trim()) {
    targetAssigneeIds = [userId.trim()];
  }

  if (targetAssigneeIds.length > 0) {
    const validUsers = await db
      .select({ id: userTable.id })
      .from(userTable)
      .where(inArray(userTable.id, targetAssigneeIds));

    if (validUsers.length !== targetAssigneeIds.length) {
      throw new HTTPException(404, { message: "Assignee not found" });
    }
  }

  const primaryUserId =
    targetAssigneeIds.length > 0 ? targetAssigneeIds[0] : null;

  await assertValidTaskStatus(resolvedStatus, projectId);

  const column = await db.query.columnTable.findFirst({
    where: and(
      eq(columnTable.projectId, projectId),
      eq(columnTable.slug, resolvedStatus),
    ),
  });

  const [maxPositionResult] = await db
    .select({ maxPosition: max(taskTable.position) })
    .from(taskTable)
    .where(
      and(
        eq(taskTable.projectId, projectId),
        column?.id
          ? eq(taskTable.columnId, column.id)
          : eq(taskTable.status, resolvedStatus),
      ),
    );

  const nextPosition = (maxPositionResult?.maxPosition ?? 0) + 1;

  const createdTask = await db.transaction(async (tx) => {
    const taskNumber = await claimTaskNumber(projectId, tx);

    const [task] = await tx
      .insert(taskTable)
      .values({
        projectId,
        userId: primaryUserId,
        title: title || "",
        status: resolvedStatus,
        columnId: column?.id ?? null,
        startDate: startDate || null,
        dueDate: dueDate || null,
        description: description || "",
        priority: resolvedPriority,
        number: taskNumber,
        position: nextPosition,
      })
      .returning();

    if (task && targetAssigneeIds.length > 0) {
      await tx.insert(taskAssigneeTable).values(
        targetAssigneeIds.map((uId) => ({
          taskId: task.id,
          userId: uId,
        })),
      );
    }

    return task;
  });

  if (!createdTask) {
    throw new HTTPException(500, {
      message: "Failed to create task",
    });
  }

  const assigneesData = await db
    .select({
      id: userTable.id,
      name: userTable.name,
      image: userTable.image,
    })
    .from(taskAssigneeTable)
    .innerJoin(userTable, eq(taskAssigneeTable.userId, userTable.id))
    .where(eq(taskAssigneeTable.taskId, createdTask.id));

  await publishEvent("task.created", {
    ...createdTask,
    taskId: createdTask.id,
    userId: createdTask.userId ?? "",
    currentUserId: currentUserId,
    type: "created",
    content: null,
  });

  return {
    ...createdTask,
    assignees: assigneesData,
    assigneeIds: targetAssigneeIds,
    assigneeName: assigneesData[0]?.name,
    assigneeImage: assigneesData[0]?.image,
  };
}

export default createTask;
