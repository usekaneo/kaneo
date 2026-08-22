import { sql } from "drizzle-orm";
import db from "../database";

/**
 * Repairs time entries written before duration was derived from the timestamps.
 *
 * Closed entries persisted duration 0 regardless of how long they ran, and open
 * entries persisted 0 rather than "not finished yet". Both are recomputed here.
 * Idempotent: a second run matches no rows.
 */
export async function backfillTimeEntryDurations() {
  try {
    const closed = await db.execute(sql`
      UPDATE time_entry
      SET duration = FLOOR(EXTRACT(EPOCH FROM (end_time - start_time)))
      WHERE end_time IS NOT NULL
        AND end_time >= start_time
        AND (duration IS NULL OR duration = 0)
        AND FLOOR(EXTRACT(EPOCH FROM (end_time - start_time))) <> 0;
    `);

    const open = await db.execute(sql`
      UPDATE time_entry
      SET duration = NULL
      WHERE end_time IS NULL
        AND duration = 0;
    `);

    const repaired = (closed.rowCount ?? 0) + (open.rowCount ?? 0);
    if (repaired > 0) {
      console.log(`✅ Backfilled duration on ${repaired} time entries.`);
    }
  } catch (error) {
    console.error("Failed to backfill time entry durations", error);
  }
}
