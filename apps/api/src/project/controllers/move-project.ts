import { and, eq, inArray, isNotNull, ne, notInArray, sql } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import {
  assetTable,
  labelTable,
  projectTable,
  taskTable,
  userNotificationWorkspaceProjectTable,
  workspaceUserTable,
} from "../../database/schema";
import { publishEvent } from "../../events";

async function moveProject(
  id: string,
  sourceWorkspaceId: string,
  targetWorkspaceId: string,
  currentUserId: string,
) {
  if (sourceWorkspaceId === targetWorkspaceId) {
    throw new HTTPException(400, {
      message: "Project already belongs to this workspace",
    });
  }

  const { movedProject, unassignedTasks } = await db.transaction(async (tx) => {
    // Locked for the life of the transaction: the request was authorized
    // against the source workspace, so a concurrent move would invalidate that
    // basis while this one is still deciding what side data to rewrite.
    const [existingProject] = await tx
      .select()
      .from(projectTable)
      .where(
        and(
          eq(projectTable.id, id),
          eq(projectTable.workspaceId, sourceWorkspaceId),
        ),
      )
      .for("update");

    if (!existingProject) {
      throw new HTTPException(404, {
        message:
          "Project doesn't exist or doesn't belong to the specified workspace",
      });
    }

    // The key doubles as the ticket-id prefix (KAN-12), and short-id lookup
    // resolves it per workspace with a limit of 1. Two projects sharing a key
    // in one workspace would make those ids ambiguous, so the move is refused
    // rather than silently renaming a project out from under its ticket ids.
    // Compared case-insensitively, since the lookup is. Archived projects
    // count: their tasks still resolve by short id.
    const [keyConflict] = await tx
      .select({ name: projectTable.name })
      .from(projectTable)
      .where(
        and(
          eq(projectTable.workspaceId, targetWorkspaceId),
          ne(projectTable.id, id),
          sql`lower(${projectTable.slug}) = lower(${existingProject.slug})`,
        ),
      )
      .limit(1);

    if (keyConflict) {
      throw new HTTPException(409, {
        message: `The target workspace already has a project using the key "${existingProject.slug}" (${keyConflict.name}). Change this project's key before moving it.`,
      });
    }

    // These rows point at both the project and a notification rule via
    // composite foreign keys carrying workspace_id. Updating the project's
    // workspace cascades into them and then violates the rule-side key,
    // since the rule stays behind in the source workspace.
    await tx
      .delete(userNotificationWorkspaceProjectTable)
      .where(
        and(
          eq(userNotificationWorkspaceProjectTable.projectId, id),
          eq(
            userNotificationWorkspaceProjectTable.workspaceId,
            sourceWorkspaceId,
          ),
        ),
      );

    const tasks = await tx
      .select({
        id: taskTable.id,
        userId: taskTable.userId,
        title: taskTable.title,
      })
      .from(taskTable)
      .where(eq(taskTable.projectId, id));

    let unassigned: typeof tasks = [];
    const assigneeIds = [
      ...new Set(
        tasks
          .map((task) => task.userId)
          .filter((userId): userId is string => Boolean(userId)),
      ),
    ];

    if (assigneeIds.length > 0) {
      const targetMembers = await tx
        .select({ userId: workspaceUserTable.userId })
        .from(workspaceUserTable)
        .where(
          and(
            eq(workspaceUserTable.workspaceId, targetWorkspaceId),
            inArray(workspaceUserTable.userId, assigneeIds),
          ),
        );

      const memberIds = new Set(targetMembers.map((member) => member.userId));
      // Kept as whole rows rather than a count: each one needs a
      // `task.unassigned` event afterwards, which carries the title.
      unassigned = tasks.filter(
        (task) => task.userId && !memberIds.has(task.userId),
      );

      if (unassigned.length > 0) {
        // Predicated on the assignees rather than the task ids: the member set
        // is bounded by workspace size, while the task list isn't, and Postgres
        // caps a statement at 65535 bind parameters.
        await tx
          .update(taskTable)
          .set({ userId: null })
          .where(
            and(
              eq(taskTable.projectId, id),
              isNotNull(taskTable.userId),
              memberIds.size > 0
                ? notInArray(taskTable.userId, [...memberIds])
                : undefined,
            ),
          );
      }
    }

    const [movedProject] = await tx
      .update(projectTable)
      .set({ workspaceId: targetWorkspaceId })
      .where(
        and(
          eq(projectTable.id, id),
          eq(projectTable.workspaceId, sourceWorkspaceId),
        ),
      )
      .returning();

    if (!movedProject) {
      throw new HTTPException(409, {
        message: "Project was moved to another workspace, please try again",
      });
    }

    // Assets and task labels denormalize the project's workspace.
    await tx
      .update(assetTable)
      .set({ workspaceId: targetWorkspaceId })
      .where(eq(assetTable.projectId, id));

    // Subquery rather than a materialized id list: this one scales with the
    // project's total task count.
    await tx
      .update(labelTable)
      .set({ workspaceId: targetWorkspaceId })
      .where(
        inArray(
          labelTable.taskId,
          tx
            .select({ id: taskTable.id })
            .from(taskTable)
            .where(eq(taskTable.projectId, id)),
        ),
      );

    return { movedProject, unassignedTasks: unassigned };
  });

  // Published after the transaction commits, so a rollback can't leave behind
  // activity rows or webhook deliveries for a move that never happened. Each
  // task gets its own event, matching how bulk assignee changes report.
  for (const task of unassignedTasks) {
    await publishEvent("task.unassigned", {
      taskId: task.id,
      projectId: id,
      userId: currentUserId,
      oldAssignee: task.userId,
      title: task.title,
      type: "unassigned",
    });
  }

  return { ...movedProject, unassignedTaskCount: unassignedTasks.length };
}

export default moveProject;
