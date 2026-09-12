import { Context, type Effect } from "effect";

export type EventsShape = {
  readonly publish: (type: string, data: unknown) => Effect.Effect<void>;
};

export class Events extends Context.Service<Events, EventsShape>()(
  "kaneo/Events",
) {}
