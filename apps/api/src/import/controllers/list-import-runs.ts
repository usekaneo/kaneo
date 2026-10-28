import { desc, eq } from "drizzle-orm";
import db from "../../database";
import { importRunTable } from "../../database/schema";
import { markStaleRuns } from "../runs/mark-stale-runs";
import { toImportRunResponse } from "../runs/to-import-run-response";

const LISTED_RUNS = 20;

async function listImportRuns(workspaceId: string) {
  const rows = await db
    .select()
    .from(importRunTable)
    .where(eq(importRunTable.workspaceId, workspaceId))
    .orderBy(desc(importRunTable.createdAt), desc(importRunTable.id))
    .limit(LISTED_RUNS);

  const now = new Date();
  await markStaleRuns(rows, now);

  return { runs: rows.map((row) => toImportRunResponse(row, now)) };
}

export default listImportRuns;
