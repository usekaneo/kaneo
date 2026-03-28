import { and, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { columnTable, projectTable, taskTable } from "../../database/schema";
import { publishEvent } from "../../events";
import {
  coercePriority,
  coerceStatus,
  getValidTaskStatuses,
} from "../validate-task-fields";
import getNextTaskNumber from "./get-next-task-number";

type ImportTask = {
  title: string;
  description?: string;
  status: string;
  priority?: string;
  startDate?: string;
  dueDate?: string;
  userId?: string | null;
};

async function importTasks(projectId: string, tasksToImport: ImportTask[]) {
  const project = await db.query.projectTable.findFirst({
    where: eq(projectTable.id, projectId),
  });

  if (!project) {
    throw new HTTPException(404, {
      message: "Project not found",
    });
  }

  const nextTaskNumber = await getNextTaskNumber(projectId);
  let taskNumber = nextTaskNumber;
  const validStatuses = await getValidTaskStatuses(projectId);

  const results = [];

  for (const taskData of tasksToImport) {
    try {
      const { status, warning: statusWarning } = coerceStatus(
        taskData.status,
        validStatuses,
      );
      const { priority, warning: priorityWarning } = coercePriority(
        taskData.priority || "low",
      );
      const warnings = [statusWarning, priorityWarning].filter(Boolean);

      const column = await db.query.columnTable.findFirst({
        where: and(
          eq(columnTable.projectId, projectId),
          eq(columnTable.slug, status),
        ),
      });

      const [createdTask] = await db
        .insert(taskTable)
        .values({
          projectId,
          userId: taskData.userId || null,
          title: taskData.title,
          status,
          columnId: column?.id ?? null,
          startDate: taskData.startDate ? new Date(taskData.startDate) : null,
          dueDate: taskData.dueDate ? new Date(taskData.dueDate) : null,
          description: taskData.description || "",
          priority,
          number: ++taskNumber,
        })
        .returning();

      if (createdTask) {
        await publishEvent("task.created", {
          taskId: createdTask.id,
          userId: createdTask.userId ?? "",
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
