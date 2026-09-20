import { Effect, Layer } from "effect";
import { Database, type DrizzleClient, makeDatabase } from "./database";
import { Events } from "./events";

// Keys are checked against the real client so a typo in a fake fails to
// compile; the values are whatever shape the controller under test needs.
export type FakeDrizzleClient = Partial<Record<keyof DrizzleClient, unknown>>;

export function makeTestDatabase(client: FakeDrizzleClient) {
  return Layer.succeed(Database, makeDatabase(client as DrizzleClient));
}

export type PublishedEvent = { readonly type: string; readonly data: unknown };

export function makeTestEvents() {
  const published: PublishedEvent[] = [];
  const layer = Layer.succeed(Events, {
    publish: (type, data) =>
      Effect.sync(() => {
        published.push({ type, data });
      }),
  });
  return { layer, published };
}
