import { and, eq } from 'drizzle-orm';
import db from '../../database';
import { taskTable } from '../../database/schema';

async function updateTask({
  id,
  projectId,
  title,
  status,
  dueDate,
  description,
}: {
  id: string;
  projectId: string;
  assigneeId: string;
  title: string;
  status: string;
  dueDate: Date;
  description: string;
}) {
  const [existingTask] = await db
    .select()
    .from(taskTable)
    .where(and(eq(taskTable.id, id), eq(taskTable.projectId, projectId)));

  const isTaskExisting = Boolean(existingTask);

  if (!isTaskExisting) {
    throw new Error("Task doesn't exist");
  }

  const [updatedWorkspace] = await db
    .update(taskTable)
    .set({
      title,
      description,
      status,
      dueDate,
    })
    .where(and(eq(taskTable.id, id), eq(taskTable.projectId, projectId)))
    .returning();

  return updatedWorkspace;
}

export default updateTask;
