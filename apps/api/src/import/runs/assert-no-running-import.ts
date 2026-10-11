import { and, eq, gt } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { importRunTable } from "../../database/schema";
import { STALE_RUN_MS } from "./to-import-run-response";

export async function assertNoRunningImport(
  workspaceId: string,
  database: Pick<typeof db, "select"> = db,
) {
  const [running] = await database
    .select({ id: importRunTable.id })
    .from(importRunTable)
    .where(
      and(
        eq(importRunTable.workspaceId, workspaceId),
        eq(importRunTable.status, "running"),
        gt(importRunTable.heartbeatAt, new Date(Date.now() - STALE_RUN_MS)),
      ),
    )
    .limit(1);

  if (running) {
    throw new HTTPException(409, {
      message:
        "An import is already running in this workspace. Wait for it to finish, then try again.",
    });
  }
}
