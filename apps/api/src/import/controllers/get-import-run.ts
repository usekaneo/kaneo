import { and, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { importRunTable } from "../../database/schema";
import { toImportRunResponse } from "../runs/to-import-run-response";

async function getImportRun(workspaceId: string, runId: string) {
  const [row] = await db
    .select()
    .from(importRunTable)
    .where(
      and(
        eq(importRunTable.id, runId),
        eq(importRunTable.workspaceId, workspaceId),
      ),
    )
    .limit(1);

  if (!row) {
    throw new HTTPException(404, { message: "Import not found" });
  }

  return { run: toImportRunResponse(row) };
}

export default getImportRun;
