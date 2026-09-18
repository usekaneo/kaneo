import { Context, type Effect } from "effect";
import type { EventMap, EventName } from "../events/catalog";

export type EventsShape = {
  readonly publish: <K extends EventName>(
    type: K,
    data: EventMap[K],
  ) => Effect.Effect<void>;
};

export class Events extends Context.Service<Events, EventsShape>()(
  "kaneo/Events",
) {}
