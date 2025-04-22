import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { projectTable, taskTable } from "../../database/schema";
import { publishEvent } from "../../events";
import getNextTaskNumber from "./get-next-task-number";

type ImportTask = {
  title: string;
  description?: string;
  status: string;
  priority?: string;
  dueDate?: string;
  userEmail?: string | null;
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

  const results = [];

  for (const taskData of tasksToImport) {
    try {
      const [createdTask] = await db
        .insert(taskTable)
        .values({
          projectId,
          userEmail: taskData.userEmail || null,
          title: taskData.title,
          status: taskData.status,
          dueDate: taskData.dueDate ? new Date(taskData.dueDate) : null,
          description: taskData.description || "",
          priority: taskData.priority || "low",
          number: ++taskNumber,
        })
        .returning();

      if (createdTask) {
        await publishEvent("task.created", {
          taskId: createdTask.id,
          userEmail: createdTask.userEmail ?? "",
          type: "create",
          content: "imported the task",
        });

        results.push({
          success: true,
          task: createdTask,
        });
      } else {
        results.push({
          success: false,
          error: "Failed to create task",
          task: taskData,
        });
      }
    } catch (error) {
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
