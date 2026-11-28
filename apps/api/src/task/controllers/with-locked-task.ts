import { eq, getTableColumns } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { projectTable, taskTable } from "../../database/schema";

type TaskTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
export async function withLockedTask<T>(
  id: string,
  mutate: (
    tx: TaskTransaction,
    before: typeof taskTable.$inferSelect,
  ) => Promise<T>,
) {
  return db.transaction(async (tx) => {
    const [row] = await tx
      .select({
        before: getTableColumns(taskTable),
        workspaceId: projectTable.workspaceId,
      })
      .from(taskTable)
      .innerJoin(projectTable, eq(taskTable.projectId, projectTable.id))
      .where(eq(taskTable.id, id))
      .for("update", { of: taskTable });
    if (!row) throw new HTTPException(404, { message: "Task not found" });
    return { ...row, after: await mutate(tx, row.before) };
  });
}
