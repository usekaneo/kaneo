import { and, eq } from "drizzle-orm";
import db from "../../database";
import { importRunTable } from "../../database/schema";

export type RunChanges = Partial<
  Pick<
    typeof importRunTable.$inferInsert,
    "status" | "message" | "projects" | "error" | "finishedAt"
  >
>;

export async function updateRunningRun(
  runId: string,
  changes: RunChanges,
): Promise<boolean> {
  const updated = await db
    .update(importRunTable)
    .set({ ...changes, heartbeatAt: new Date() })
    .where(
      and(eq(importRunTable.id, runId), eq(importRunTable.status, "running")),
    )
    .returning({ id: importRunTable.id });
  return updated.length > 0;
}
