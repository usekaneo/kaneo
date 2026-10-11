import { and, eq } from "drizzle-orm";
import db from "../../database";
import { importRunTable } from "../../database/schema";
import { logImportError } from "../log-import-error";

type RunChanges = Partial<
  Pick<
    typeof importRunTable.$inferInsert,
    "status" | "message" | "projects" | "error" | "finishedAt"
  >
>;

export type ImportRunStore = {
  save(changes: RunChanges): Promise<void>;
  isDetached(): boolean;
  flush(): Promise<void>;
};

export function createImportRunStore(runId: string): ImportRunStore {
  let chain = Promise.resolve();
  let detached = false;

  async function write(changes: RunChanges) {
    if (detached) return;
    try {
      const updated = await db
        .update(importRunTable)
        .set({ ...changes, heartbeatAt: new Date() })
        .where(
          and(
            eq(importRunTable.id, runId),
            eq(importRunTable.status, "running"),
          ),
        )
        .returning({ id: importRunTable.id });
      if (updated.length === 0) detached = true;
    } catch (error) {
      logImportError("Failed to save import progress", runId, error);
    }
  }

  return {
    save(changes) {
      chain = chain.then(() => write(changes));
      return chain;
    },
    isDetached: () => detached,
    flush: () => chain,
  };
}
