import { and, eq, inArray } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import {
  projectTable,
  taskAssigneeTable,
  taskTable,
  userTable,
  workspaceUserTable,
} from "../../database/schema";
import { publishEvent } from "../../events";

async function updateTaskAssignee({
  id,
  userId,
  assigneeIds,
  currentUserId,
}: {
  id: string;
  userId?: string | null;
  assigneeIds?: string[];
  currentUserId: string;
}) {
  const existingTask = await db.query.taskTable.findFirst({
    where: eq(taskTable.id, id),
  });

  if (!existingTask) {
    throw new HTTPException(404, {
      message: "Task not found",
    });
  }

  let targetAssigneeIds: string[] = [];
  if (assigneeIds !== undefined) {
    targetAssigneeIds = Array.from(
      new Set(assigneeIds.map((id) => id.trim()).filter(Boolean)),
    );
  } else if (userId !== undefined) {
    targetAssigneeIds = userId?.trim() ? [userId.trim()] : [];
  } else {
    targetAssigneeIds = existingTask.userId ? [existingTask.userId] : [];
  }

  if (targetAssigneeIds.length > 0) {
    const project = await db.query.projectTable.findFirst({
      where: eq(projectTable.id, existingTask.projectId),
    });

    if (project) {
      const validMembers = await db
        .select({ userId: workspaceUserTable.userId })
        .from(workspaceUserTable)
        .where(
          and(
            eq(workspaceUserTable.workspaceId, project.workspaceId),
            inArray(workspaceUserTable.userId, targetAssigneeIds),
          ),
        );

      if (validMembers.length !== targetAssigneeIds.length) {
        throw new HTTPException(404, { message: "Assignee not found" });
      }
    } else {
      const validUsers = await db
        .select({ id: userTable.id })
        .from(userTable)
        .where(inArray(userTable.id, targetAssigneeIds));

      if (validUsers.length !== targetAssigneeIds.length) {
        throw new HTTPException(404, { message: "Assignee not found" });
      }
    }
  }

  const primaryAssigneeId =
    targetAssigneeIds.length > 0 ? targetAssigneeIds[0] : null;

  await db.transaction(async (tx) => {
    await tx
      .update(taskTable)
      .set({ userId: primaryAssigneeId })
      .where(eq(taskTable.id, id));

    await tx.delete(taskAssigneeTable).where(eq(taskAssigneeTable.taskId, id));

    if (targetAssigneeIds.length > 0) {
      await tx.insert(taskAssigneeTable).values(
        targetAssigneeIds.map((uId) => ({
          taskId: id,
          userId: uId,
        })),
      );
    }
  });

  const updatedTask = await db.query.taskTable.findFirst({
    where: eq(taskTable.id, id),
  });

  if (!updatedTask) {
    throw new HTTPException(500, {
      message: "Failed to update task assignee",
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
    .where(eq(taskAssigneeTable.taskId, id));

  if (targetAssigneeIds.length === 0) {
    await publishEvent("task.unassigned", {
      taskId: updatedTask.id,
      projectId: updatedTask.projectId,
      userId: currentUserId,
      title: updatedTask.title,
      type: "unassigned",
    });
  } else {
    await publishEvent("task.assignee_changed", {
      taskId: updatedTask.id,
      projectId: updatedTask.projectId,
      userId: currentUserId,
      oldAssignee: existingTask.userId,
      newAssignee: assigneesData
        .map((a) => a.name)
        .filter(Boolean)
        .join(", "),
      newAssigneeId: primaryAssigneeId,
      assigneeIds: targetAssigneeIds,
      title: updatedTask.title,
      type: "assignee_changed",
    });
  }

  return {
    ...updatedTask,
    assignees: assigneesData,
    assigneeIds: targetAssigneeIds,
  };
}

export default updateTaskAssignee;
