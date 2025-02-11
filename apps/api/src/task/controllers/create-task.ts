import { count, eq } from "drizzle-orm";
import db from "../../database";
import { taskTable, userTable } from "../../database/schema";

async function getNextTaskNumber(projectId: string) {
  const [task] = await db
    .select({ count: count() })
    .from(taskTable)
    .where(eq(taskTable.projectId, projectId));

  return task.count;
}

async function createTask(body: {
  projectId: string;
  userEmail: string;
  title: string;
  status: string;
  dueDate: Date | null;
  description: string;
  priority: string;
}) {
  const [assignee] = await db
    .select({ name: userTable.name })
    .from(userTable)
    .where(eq(userTable.email, body.userEmail));

  const nextTaskNumber = await getNextTaskNumber(body.projectId);

  const [createdTask] = await db
    .insert(taskTable)
    .values({
      ...body,
      number: nextTaskNumber + 1,
    })
    .returning();

  return {
    ...createdTask,
    assigneeName: assignee?.name,
  };
}

export default createTask;
