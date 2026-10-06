import { eq } from "drizzle-orm";
import db, { schema } from "../../../../apps/api/src/database";
import type { createProjectFixture } from "../fixtures";

export async function createTaskFixture(
  project: Awaited<ReturnType<typeof createProjectFixture>>,
  title: string,
  assigneeId: string,
) {
  const [task] = await db
    .insert(schema.taskTable)
    .values({
      projectId: project.project.id,
      title,
      status: project.columns.todo.slug,
      columnId: project.columns.todo.id,
      userId: assigneeId,
      number: 1,
    })
    .returning();
  await db
    .update(schema.projectTable)
    .set({ lastTaskNumber: 1 })
    .where(eq(schema.projectTable.id, project.project.id));
  return task;
}
