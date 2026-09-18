import { Effect } from "effect";
import { findTimeEntry } from "../../database/lookups";
import { Database } from "../../effect/database";

const getTimeEntry = Effect.fn("timeEntry.getTimeEntry")(function* (
  id: string,
) {
  const database = yield* Database;
  const [timeEntry] = yield* database.query((db) => findTimeEntry(id, db));

  return timeEntry;
});

export default getTimeEntry;
