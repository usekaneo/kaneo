import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { taskTable } from "../../database/schema";

type TaskTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
export async function withLockedTask<T>(
  id: string,
  mutate: (
    tx: TaskTransaction,
    before: typeof taskTable.$inferSelect,
  ) => Promise<T>,
) {
  return db.transaction(async (tx) => {
    const [before] = await tx
      .select()
      .from(taskTable)
      .where(eq(taskTable.id, id))
      .for("update");
    if (!before) throw new HTTPException(404, { message: "Task not found" });
    return { before, after: await mutate(tx, before) };
  });
}
