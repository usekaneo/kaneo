import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../database";
import { projectTable, taskTable } from "../database/schema";

export async function assertTaskWritable(taskId: string): Promise<void> {
  const [row] = await db
    .select({
      archivedAt: projectTable.archivedAt,
    })
    .from(taskTable)
    .innerJoin(projectTable, eq(taskTable.projectId, projectTable.id))
    .where(eq(taskTable.id, taskId))
    .limit(1);

  if (!row) {
    throw new HTTPException(404, { message: "Task not found" });
  }

  if (row.archivedAt) {
    throw new HTTPException(403, {
      message: "Project is archived and read-only",
    });
  }
}
