import { and, eq, lt } from "drizzle-orm";
import db from "../../database";
import { importRunTable } from "../../database/schema";
import { logImportError } from "../log-import-error";
import {
  type ImportRunRow,
  interruptedRun,
  isStaleRun,
  STALE_RUN_MS,
} from "./to-import-run-response";

export async function markStaleRuns(rows: readonly ImportRunRow[], now: Date) {
  const cutoff = new Date(now.getTime() - STALE_RUN_MS);
  const stale = rows.filter((row) => isStaleRun(row, now));
  const results = await Promise.allSettled(
    stale.map((row) =>
      db
        .update(importRunTable)
        .set(interruptedRun(row))
        .where(
          and(
            eq(importRunTable.id, row.id),
            eq(importRunTable.status, "running"),
            lt(importRunTable.heartbeatAt, cutoff),
          ),
        ),
    ),
  );
  results.forEach((result, index) => {
    const row = stale[index];
    if (result.status === "rejected" && row) {
      logImportError(
        "Failed to mark a stale import run",
        row.id,
        result.reason,
      );
    }
  });
}
