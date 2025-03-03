import { count, eq } from "drizzle-orm";
import db from "../../database";
import { taskTable, userTable } from "../../database/schema";
import { publishEvent } from "../../events";

async function getNextTaskNumber(projectId: string) {
  const [task] = await db
    .select({ count: count() })
    .from(taskTable)
    .where(eq(taskTable.projectId, projectId));

  return task.count;
}

async function createTask(body: {
  projectId: string;
  userEmail: string | null;
  title: string | null;
  status: string | null;
  dueDate: Date | null;
  description: string | null;
  priority: string | null;
}) {
  const [assignee] = await db
    .select({ name: userTable.name })
    .from(userTable)
    .where(eq(userTable.email, body.userEmail ?? ""));

  const nextTaskNumber = await getNextTaskNumber(body.projectId);

  const [createdTask] = await db
    .insert(taskTable)
    .values({
      ...body,
      userEmail: body.userEmail ?? "",
      title: body.title ?? "",
      status: body.status ?? "",
      dueDate: body.dueDate ?? new Date(),
      description: body.description ?? "",
      priority: body.priority ?? "",
      number: nextTaskNumber + 1,
    })
    .returning();

  await publishEvent("task.created", {
    taskId: createdTask.id,
    userEmail: createdTask.userEmail ?? "",
    type: "create",
    content: "created the task",
  });

  return {
    ...createdTask,
    assigneeName: assignee?.name,
  };
}

export default createTask;
