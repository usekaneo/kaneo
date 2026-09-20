import { Effect, Layer } from "effect";
import db from "../database";
import { publishEvent } from "../events";
import { Database, makeDatabase } from "./database";
import { Events } from "./events";

export const DatabaseLive = Layer.succeed(Database, makeDatabase(db));

// Awaited, not returned, so a bare value from publishEvent resolves like the
// original await did.
export const EventsLive = Layer.succeed(Events, {
  publish: (type, data) =>
    Effect.promise(async () => {
      await publishEvent(type, data);
    }),
});
