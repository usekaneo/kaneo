import { and, eq, lt } from "drizzle-orm";
import db from "../../database";
import { importRunTable } from "../../database/schema";
import {
  type ImportRunRow,
  interruptedRun,
  isStaleRun,
  STALE_RUN_MS,
} from "./to-import-run-response";

export async function markStaleRuns(rows: readonly ImportRunRow[], now: Date) {
  const cutoff = new Date(now.getTime() - STALE_RUN_MS);
  await Promise.all(
    rows
      .filter((row) => isStaleRun(row, now))
      .map((row) =>
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
}
