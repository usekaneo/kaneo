import { eq } from "drizzle-orm";
import db from "../../../database";
import { taskTable, userTable } from "../../../database/schema";
import getNextTaskNumber from "./get-next-task-number";

async function createTask({
  projectId,
  userEmail,
  title,
  status,
  dueDate,
  description,
  priority,
}: {
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
    .where(eq(userTable.email, userEmail ?? ""));

  const nextTaskNumber = await getNextTaskNumber(projectId);

  const [createdTask] = await db
    .insert(taskTable)
    .values({
      projectId,
      userEmail: userEmail ?? "",
      title: title ?? "",
      status: status ?? "",
      dueDate: dueDate ?? new Date(),
      description: description ?? "",
      priority: priority ?? "",
      number: nextTaskNumber + 1,
    })
    .returning();

  // TODO:
  // await publishEvent("task.created", {
  //   taskId: createdTask.id,
  //   userEmail: createdTask.userEmail ?? "",
  //   type: "create",
  //   content: "created the task",
  // });

  return {
    ...createdTask,
    assigneeName: assignee?.name,
  };
}

export default createTask;
