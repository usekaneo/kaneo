import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { taskAssigneeTable, taskTable, userTable } from "../../database/schema";

async function getTask(taskId: string) {
  const task = await db
    .select({
      id: taskTable.id,
      title: taskTable.title,
      number: taskTable.number,
      description: taskTable.description,
      status: taskTable.status,
      priority: taskTable.priority,
      startDate: taskTable.startDate,
      dueDate: taskTable.dueDate,
      position: taskTable.position,
      createdAt: taskTable.createdAt,
      userId: taskTable.userId,
      assigneeName: userTable.name,
      assigneeId: userTable.id,
      assigneeImage: userTable.image,
      projectId: taskTable.projectId,
    })
    .from(taskTable)
    .leftJoin(userTable, eq(taskTable.userId, userTable.id))
    .where(eq(taskTable.id, taskId))
    .limit(1);

  if (!task.length || !task[0]) {
    throw new HTTPException(404, {
      message: "Task not found",
    });
  }

  const targetTask = task[0];

  const assigneesData = await db
    .select({
      id: userTable.id,
      name: userTable.name,
      image: userTable.image,
    })
    .from(taskAssigneeTable)
    .innerJoin(userTable, eq(taskAssigneeTable.userId, userTable.id))
    .where(eq(taskAssigneeTable.taskId, taskId));

  let assignees: Array<{
    id: string;
    name: string | null;
    image: string | null;
  }> = assigneesData;
  if (assignees.length === 0 && targetTask.assigneeId) {
    assignees = [
      {
        id: targetTask.assigneeId,
        name: targetTask.assigneeName,
        image: targetTask.assigneeImage ?? null,
      },
    ];
  }

  return {
    ...targetTask,
    assignees,
    assigneeIds: assignees.map((a) => a.id),
  };
}

export default getTask;
