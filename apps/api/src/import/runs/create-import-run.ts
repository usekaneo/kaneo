import type { ImportSourceId } from "@kaneo/importers";
import { sql } from "drizzle-orm";
import db from "../../database";
import { importRunTable } from "../../database/schema";
import type { ImportRunProject } from "../import-run-project";
import { assertNoRunningImport } from "./assert-no-running-import";

export async function createImportRun({
  workspaceId,
  userId,
  source,
  includeComments,
  projects,
}: {
  workspaceId: string;
  userId: string;
  source: ImportSourceId;
  includeComments: boolean;
  projects: ImportRunProject[];
}) {
  return db.transaction(async (tx) => {
    await tx.execute(
      sql`SELECT pg_advisory_xact_lock(hashtext('import-run'), hashtext(${workspaceId}))`,
    );
    await assertNoRunningImport(workspaceId, tx);

    const [run] = await tx
      .insert(importRunTable)
      .values({
        workspaceId,
        userId,
        source,
        includeComments,
        projects,
        message: "Starting the import",
      })
      .returning();
    if (!run) throw new Error("Failed to create the import run");
    return run;
  });
}
