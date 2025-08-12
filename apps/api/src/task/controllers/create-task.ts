import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { taskTable, userTable } from "../../database/schema";
import { publishEvent } from "../../events";
import getNextTaskNumber from "./get-next-task-number";

async function createTask({
  projectId,
  userId,
  title,
  status,
  dueDate,
  description,
  priority,
}: {
  projectId: string;
  userId?: string;
  title: string;
  status: string;
  dueDate?: Date;
  description?: string;
  priority?: string;
}) {
  const [assignee] = await db
    .select({ name: userTable.name })
    .from(userTable)
    .where(eq(userTable.id, userId ?? ""));

  const nextTaskNumber = await getNextTaskNumber(projectId);

  const [createdTask] = await db
    .insert(taskTable)
    .values({
      projectId,
      userId: userId || null,
      title: title || "",
      status: status || "",
      dueDate: dueDate || new Date(),
      description: description || "",
      priority: priority || "",
      number: nextTaskNumber + 1,
    })
    .returning();

  if (!createdTask) {
    throw new HTTPException(500, {
      message: "Failed to create task",
    });
  }

  await publishEvent("task.created", {
    ...createdTask,
    taskId: createdTask.id,
    userId: createdTask.userId ?? "",
    type: "task",
    content: "created the task",
  });

  return {
    ...createdTask,
    assigneeName: assignee?.name,
  };
}

export default createTask;
