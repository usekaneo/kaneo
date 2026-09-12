import { Effect, Layer } from "effect";
import db from "../database";
import { publishEvent } from "../events";
import { Database, makeDatabase } from "./database";
import { Events } from "./events";

export const DatabaseLive = Layer.succeed(Database, makeDatabase(db));

// Awaited exactly as the controllers did before the migration: a rejected
// publishEvent becomes a defect, which the handler boundary rethrows
// unchanged, so it still surfaces the same way.
export const EventsLive = Layer.succeed(Events, {
  publish: (type, data) =>
    Effect.promise(async () => {
      await publishEvent(type, data);
    }),
});
