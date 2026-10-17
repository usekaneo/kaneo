import { and, asc, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { columnTable, projectTable, taskTable } from "../../database/schema";
import { publishEvent } from "../../events";
import { filterUsersWithProjectAccess } from "../../project-access/filter-users-with-project-access";
import {
  NO_PROJECT_ACCESS,
  NOT_ASSIGNABLE,
} from "../../utils/assert-assignable-user";
import { coercePriority, VIRTUAL_STATUSES } from "../validate-task-fields";
import { resolveImportTaskStatus } from "../resolve-import-task-status";
import { claimTaskNumber } from "./claim-task-numbers";
import { nextTaskPosition } from "./next-task-position";
import { resolveImportAssignees } from "../resolve-import-assignees";

export type ImportTask = {
  title: string;
  description?: string;
  status: string;
  priority?: string;
  startDate?: string | null;
  dueDate?: string | null;
  userId?: string | null;
};

async function importTasks(
  projectId: string,
  tasksToImport: ImportTask[],
  currentUserId?: string,
) {
  const project = await db.query.projectTable.findFirst({
    where: eq(projectTable.id, projectId),
  });

  if (!project) {
    throw new HTTPException(404, {
      message: "Project not found",
    });
  }

  const assigneeIds = [
    ...new Set(
      tasksToImport
        .map((task) => task.userId?.trim())
        .filter((id): id is string => Boolean(id)),
    ),
  ];

  const assignees = await resolveImportAssignees(
    assigneeIds,
    project.workspaceId,
  );
  const assignableIds = await filterUsersWithProjectAccess(
    assignees.values(),
    projectId,
  );

  const columns = await db.query.columnTable.findMany({
    where: eq(columnTable.projectId, projectId),
    orderBy: asc(columnTable.position),
  });

  const results = [];

  for (const taskData of tasksToImport) {
    const reference = taskData.userId?.trim() || null;
    const assigneeId = reference ? assignees.get(reference) : null;

    if (reference && (!assigneeId || !assignableIds.has(assigneeId))) {
      results.push({
        success: false,
        error: assigneeId ? NO_PROJECT_ACCESS : NOT_ASSIGNABLE,
        task: taskData,
      });
      continue;
    }

    try {
      const resolved = resolveImportTaskStatus(taskData.status, columns);
      if ("error" in resolved) {
        results.push({ success: false, error: resolved.error, task: taskData });
        continue;
      }
      const { status: resolvedStatus, warning: statusWarning } = resolved;
      const { priority, warning: priorityWarning } = coercePriority(
        taskData.priority || "low",
      );
      const warnings = [statusWarning, priorityWarning].filter(Boolean);

      const createdTask = await db.transaction(async (tx) => {
        const taskNumber = await claimTaskNumber(projectId, tx);
        // Recheck the snapshot's column and retain it until the insert commits.
        const [column] = await tx
          .select({ id: columnTable.id })
          .from(columnTable)
          .where(
            and(
              eq(columnTable.projectId, projectId),
              eq(columnTable.slug, resolvedStatus),
            ),
          )
          .limit(1)
          .for("key share");
        const status =
          column ||
          VIRTUAL_STATUSES.some((virtual) => virtual === resolvedStatus)
            ? resolvedStatus
            : "planned";
        if (status !== resolvedStatus) {
          warnings.push(
            `Status "${resolvedStatus}" no longer has a column. Mapped to "planned".`,
          );
        }
        const position = await nextTaskPosition(
          tx,
          projectId,
          status,
          column?.id ?? null,
        );

        const [task] = await tx
          .insert(taskTable)
          .values({
            projectId,
            userId: assigneeId ?? null,
            title: taskData.title,
            status,
            columnId: column?.id ?? null,
            startDate: taskData.startDate ? new Date(taskData.startDate) : null,
            dueDate: taskData.dueDate ? new Date(taskData.dueDate) : null,
            description: taskData.description || "",
            priority,
            number: taskNumber,
            position,
          })
          .returning();

        return task;
      });

      if (createdTask) {
        await publishEvent("task.created", {
          ...createdTask,
          taskId: createdTask.id,
          userId: createdTask.userId ?? "",
          currentUserId: currentUserId ?? "",
          type: "create",
          content: "imported the task",
        });

        results.push({
          success: true,
          task: createdTask,
          ...(warnings.length > 0 && { warnings }),
        });
      } else {
        results.push({
          success: false,
          error: "Failed to create task",
          task: taskData,
        });
      }
    } catch (error) {
      if (error instanceof HTTPException) {
        throw error;
      }
      results.push({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        task: taskData,
      });
    }
  }

  return {
    importedAt: new Date().toISOString(),
    project: {
      id: project.id,
      name: project.name,
      slug: project.slug,
    },
    results: {
      total: tasksToImport.length,
      successful: results.filter((r) => r.success).length,
      failed: results.filter((r) => !r.success).length,
      tasks: results,
    },
  };
}

export default importTasks;
