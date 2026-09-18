import { eq } from "drizzle-orm";
import { Effect } from "effect";
import { timeEntryTable } from "../../database/schema";
import { Database } from "../../effect/database";
import { timeEntryById } from "../../effect/lookups";
import { resolveDuration } from "../duration";

type UpdateTimeEntryParams = {
  timeEntryId: string;
  startTime: Date;
  endTime?: Date;
  description?: string;
};

const updateTimeEntry = Effect.fn("timeEntry.updateTimeEntry")(function* ({
  timeEntryId,
  startTime,
  endTime,
  description,
}: UpdateTimeEntryParams) {
  const database = yield* Database;

  const existingTimeEntry = yield* timeEntryById(timeEntryId);

  const effectiveEndTime = endTime ?? existingTimeEntry.endTime;

  const duration = yield* resolveDuration(
    startTime,
    effectiveEndTime ?? undefined,
  );

  const [updatedTimeEntry] = yield* database.query((db) =>
    db
      .update(timeEntryTable)
      .set({
        startTime,
        endTime: effectiveEndTime,
        duration,
        ...(description !== undefined && { description }),
      })
      .where(eq(timeEntryTable.id, timeEntryId))
      .returning(),
  );

  return updatedTimeEntry;
});

export default updateTimeEntry;
