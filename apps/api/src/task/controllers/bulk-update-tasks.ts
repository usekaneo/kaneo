import { queueStorageCleanup } from "../../storage/cleanup-queue";
import { and, asc, eq, inArray } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import {
  assetTable,
  columnTable,
  labelTable,
  projectTable,
  taskTable,
  userTable,
  taskReminderSentTable,
  workspaceUserTable,
} from "../../database/schema";
import { publishEvent } from "../../events";
import { removeLabelFromGitea } from "../../plugins/gitea/utils/sync-label-to-gitea";
import { removeLabelFromGitHub } from "../../plugins/github/utils/sync-label-to-github";
import { removeLabelFromGitlab } from "../../plugins/gitlab/utils/sync-label-to-gitlab";
import { assertAssignableUser } from "../../utils/assert-assignable-user";
import { publishTaskMutation } from "./task-mutation-effects";
import { getSubtaskParentProjects } from "../get-subtask-parent-projects";
import {
  assertValidPriority,
  assertValidTaskStatus,
} from "../validate-task-fields";

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
      title: taskTable.title,
      status: taskTable.status,
      priority: taskTable.priority,
      projectId: taskTable.projectId,
      userId: taskTable.userId,
      dueDate: taskTable.dueDate,
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

      // Validate every project's destination before the first write.
      const destinations = new Map<string, string | null>();
      for (const projectId of projectIds) {
        await assertValidTaskStatus(value, projectId);
        const column = await db.query.columnTable.findFirst({
          where: and(
            eq(columnTable.projectId, projectId),
            eq(columnTable.slug, value),
          ),
        });
        destinations.set(projectId, column?.id ?? null);
      }
      const { updatedTasks, beforeById } = await db.transaction(async (tx) => {
        const before = await tx
          .select({ id: taskTable.id, status: taskTable.status })
          .from(taskTable)
          .where(inArray(taskTable.id, foundIds))
          .orderBy(asc(taskTable.id))
          .for("update");
        const beforeById = new Map(before.map((task) => [task.id, task]));
        const result: Array<{
          id: string;
          projectId: string;
          status: string;
          title: string;
          userId: string | null;
        }> = [];
        for (const projectId of projectIds) {
          const projectTaskIds = tasks
            .filter((task) => task.projectId === projectId)
            .map((task) => task.id);
          const changed = await tx
            .update(taskTable)
            .set({
              status: value,
              columnId: destinations.get(projectId) ?? null,
            })
            .where(
              and(
                inArray(taskTable.id, projectTaskIds),
                eq(taskTable.projectId, projectId),
              ),
            )
            .returning({
              id: taskTable.id,
              projectId: taskTable.projectId,
              status: taskTable.status,
              title: taskTable.title,
              userId: taskTable.userId,
            });
          if (changed.length !== projectTaskIds.length)
            throw new HTTPException(409, {
              message: "Tasks changed projects; retry the operation",
            });
          result.push(...changed);
        }
        return { updatedTasks: result, beforeById };
      });
      updatedCount = updatedTasks.length;
      const parentProjects = await getSubtaskParentProjects(foundIds);
      await publishEvent("subtask-parents.refresh", {
        projects: parentProjects,
      });
      for (const updatedTask of updatedTasks) {
        const before = beforeById.get(updatedTask.id)!;
        await publishTaskMutation(before, updatedTask, userId, {
          fields: ["status"],
          skipRelationRefresh: true,

          skipSubtaskParentRefresh: true,
        });
        if (before.status === updatedTask.status)
          await publishEvent("task.updated", {
            taskId: updatedTask.id,
            projectId: updatedTask.projectId,
            userId,
          });
      }
      for (const projectId of projectIds)
        await publishEvent("task-relation.refresh", { projectId, userId });
      break;
    }

    case "updatePriority": {
      if (!value) {
        throw new HTTPException(400, { message: "Priority value is required" });
      }
      assertValidPriority(value);

      const before = await db.transaction(async (tx) => {
        const locked = await tx
          .select({
            id: taskTable.id,
            projectId: taskTable.projectId,
            title: taskTable.title,
            userId: taskTable.userId,
            priority: taskTable.priority,
          })
          .from(taskTable)
          .where(inArray(taskTable.id, foundIds))
          .orderBy(asc(taskTable.id))
          .for("update");
        const originalProjects = new Map(
          tasks.map((task) => [task.id, task.projectId]),
        );
        if (
          locked.length !== foundIds.length ||
          locked.some(
            (task) => task.projectId !== originalProjects.get(task.id),
          )
        )
          throw new HTTPException(409, {
            message: "Tasks changed projects; retry the operation",
          });
        await tx
          .update(taskTable)
          .set({ priority: value })
          .where(inArray(taskTable.id, foundIds));
        return locked;
      });
      updatedCount = before.length;
      for (const task of before)
        await publishTaskMutation(
          task,
          {
            ...task,
            priority: value,
          },
          userId,
          { fields: ["priority"] },
        );
      break;
    }

    case "updateAssignee": {
      const assigneeId = value?.trim() || null;

      if (assigneeId) {
        await assertAssignableUser(assigneeId, workspaceId);
      }

      const assignee = assigneeId
        ? await db.query.userTable.findFirst({
            columns: { name: true },
            where: eq(userTable.id, assigneeId),
          })
        : undefined;
      const before = await db.transaction(async (tx) => {
        const locked = await tx
          .select({
            id: taskTable.id,
            projectId: taskTable.projectId,
            title: taskTable.title,
            userId: taskTable.userId,
          })
          .from(taskTable)
          .where(inArray(taskTable.id, foundIds))
          .orderBy(asc(taskTable.id))
          .for("update");
        const originalProjects = new Map(
          tasks.map((task) => [task.id, task.projectId]),
        );
        if (
          locked.length !== foundIds.length ||
          locked.some(
            (task) => task.projectId !== originalProjects.get(task.id),
          )
        )
          throw new HTTPException(409, {
            message: "Tasks changed projects; retry the operation",
          });
        await tx
          .update(taskTable)
          .set({ userId: assigneeId })
          .where(inArray(taskTable.id, foundIds));
        return locked;
      });
      updatedCount = before.length;
      for (const task of before)
        await publishTaskMutation(
          task,
          {
            ...task,
            userId: assigneeId,
          },
          userId,
          { fields: ["userId"], assigneeName: assignee?.name ?? null },
        );
      break;
    }

    case "delete": {
      // Relations cascade away with the children, so capture parents first.
      const parentProjects = await getSubtaskParentProjects(foundIds);
      const result = await db.transaction(async (tx) => {
        const locked = await tx
          .select({ id: taskTable.id, projectId: taskTable.projectId })
          .from(taskTable)
          .where(inArray(taskTable.id, foundIds))
          .orderBy(asc(taskTable.id))
          .for("update");
        const originalProjects = new Map(
          tasks.map((task) => [task.id, task.projectId]),
        );
        if (
          locked.length !== foundIds.length ||
          locked.some(
            (task) => task.projectId !== originalProjects.get(task.id),
          )
        )
          throw new HTTPException(409, {
            message: "Tasks changed projects; retry the operation",
          });
        const assets = await tx
          .select({ objectKey: assetTable.objectKey })
          .from(assetTable)
          .where(inArray(assetTable.taskId, foundIds));
        await queueStorageCleanup(
          tx,
          assets.map((asset) => asset.objectKey),
        );
        return tx.delete(taskTable).where(inArray(taskTable.id, foundIds));
      });

      updatedCount = result.rowCount ?? foundIds.length;

      for (const task of tasks) {
        await publishEvent("task.deleted", {
          taskId: task.id,
          projectId: task.projectId,
          userId,
          title: task.title,
        });
      }
      await publishEvent("subtask-parents.refresh", {
        projects: parentProjects,
      });
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

      if (label.workspaceId && label.workspaceId !== workspaceId) {
        throw new HTTPException(400, {
          message: "Label and tasks must belong to the same workspace",
        });
      }

      for (const task of tasks) {
        const existingAssignment = await db.query.labelTable.findFirst({
          where: and(
            eq(labelTable.name, label.name),
            eq(labelTable.taskId, task.id),
          ),
        });

        if (!existingAssignment) {
          await db
            .insert(labelTable)
            .values({
              name: label.name,
              color: label.color,
              workspaceId: workspaceId,
              taskId: task.id,
            })
            .onConflictDoNothing({
              target: [labelTable.taskId, labelTable.name],
            });
          updatedCount++;

          await publishEvent("task.label_assigned", {
            projectId: task.projectId,
            taskId: task.id,
            userId,
            type: "label_assigned",
          });
        }
      }
      break;
    }

    case "removeLabel": {
      if (!value) {
        throw new HTTPException(400, { message: "Label ID is required" });
      }

      const label = await db.query.labelTable.findFirst({
        where: eq(labelTable.id, value),
      });

      if (!label) {
        throw new HTTPException(404, { message: "Label not found" });
      }

      const deletedLabels = await db
        .delete(labelTable)
        .where(
          and(
            eq(labelTable.workspaceId, workspaceId),
            eq(labelTable.name, label.name),
            inArray(labelTable.taskId, foundIds),
          ),
        )
        .returning();

      updatedCount = deletedLabels.length;

      for (const deletedLabel of deletedLabels) {
        if (!deletedLabel.taskId) continue;

        removeLabelFromGitHub(deletedLabel.taskId, deletedLabel.name).catch(
          (error) => {
            console.error("Failed to remove label from GitHub:", error);
          },
        );
        removeLabelFromGitea(deletedLabel.taskId, deletedLabel.name).catch(
          (error) => {
            console.error("Failed to remove label from Gitea:", error);
          },
        );
        removeLabelFromGitlab(deletedLabel.taskId, deletedLabel.name).catch(
          (error) => {
            console.error("Failed to remove label from GitLab:", error);
          },
        );

        const task = tasks.find((t) => t.id === deletedLabel.taskId);
        if (!task) continue;

        await publishEvent("task.label_unassigned", {
          label: deletedLabel,
          task,
          projectId: task.projectId,
          taskId: deletedLabel.taskId,
          userId,
          type: "label_unassigned",
        });
      }
      break;
    }

    case "updateDueDate": {
      let parsedDate: Date | null = null;
      if (value) {
        parsedDate = new Date(value);
        if (Number.isNaN(parsedDate.getTime())) {
          throw new HTTPException(400, {
            message: `Invalid date value "${value}"`,
          });
        }
      }

      const { updatedTasks, beforeById } = await db.transaction(async (tx) => {
        const before = await tx
          .select({
            id: taskTable.id,
            projectId: taskTable.projectId,
            dueDate: taskTable.dueDate,
          })
          .from(taskTable)
          .where(inArray(taskTable.id, foundIds))
          .orderBy(asc(taskTable.id))
          .for("update");
        const originalProjects = new Map(
          tasks.map((task) => [task.id, task.projectId]),
        );
        if (
          before.length !== foundIds.length ||
          before.some(
            (task) => task.projectId !== originalProjects.get(task.id),
          )
        )
          throw new HTTPException(409, {
            message: "Tasks changed projects; retry the operation",
          });
        const beforeById = new Map(before.map((task) => [task.id, task]));
        const changedIds = before
          .filter((task) => task.dueDate?.getTime() !== parsedDate?.getTime())
          .map((task) => task.id);
        if (changedIds.length)
          await tx
            .delete(taskReminderSentTable)
            .where(inArray(taskReminderSentTable.taskId, changedIds));
        const updatedTasks = await tx
          .update(taskTable)
          .set({ dueDate: parsedDate })
          .where(inArray(taskTable.id, foundIds))
          .returning({
            id: taskTable.id,
            projectId: taskTable.projectId,
            title: taskTable.title,
            dueDate: taskTable.dueDate,
          });
        return { updatedTasks, beforeById };
      });
      updatedCount = updatedTasks.length;
      for (const updatedTask of updatedTasks)
        await publishTaskMutation(
          beforeById.get(updatedTask.id)!,
          updatedTask,
          userId,
          { fields: ["dueDate"] },
        );
      break;
    }

    default: {
      throw new HTTPException(400, {
        message: `Unknown operation "${operation}"`,
      });
    }
  }

  return { success: true, updatedCount };
}

export default bulkUpdateTasks;
