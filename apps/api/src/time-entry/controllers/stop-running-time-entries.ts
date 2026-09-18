import { and, eq, isNull } from "drizzle-orm";
import db from "../../database";
import { timeEntryTable } from "../../database/schema";
import { resolveDuration } from "../duration";

// A person tracks one thing at a time: starting a timer closes any other
// running one. A start in the future (clock skew) closes at its own start
// rather than producing a negative duration.
export async function stopRunningTimeEntries(userId: string, at: Date) {
  const running = await db
    .select({ id: timeEntryTable.id, startTime: timeEntryTable.startTime })
    .from(timeEntryTable)
    .where(
      and(eq(timeEntryTable.userId, userId), isNull(timeEntryTable.endTime)),
    );

  for (const entry of running) {
    const endTime = at > entry.startTime ? at : entry.startTime;
    await db
      .update(timeEntryTable)
      .set({ endTime, duration: resolveDuration(entry.startTime, endTime) })
      .where(eq(timeEntryTable.id, entry.id));
  }
}
