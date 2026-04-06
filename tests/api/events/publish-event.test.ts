import { afterEach, describe, expect, it } from "vitest";
import {
  eventContext,
  publishEvent,
  shutdownEventBus,
  subscribeToEvent,
} from "../../../apps/api/src/events/index";

describe("publishEvent / subscribeToEvent", () => {
  afterEach(async () => {
    await shutdownEventBus();
  });

  it("delivers event data to a subscriber", async () => {
    const received: unknown[] = [];

    await subscribeToEvent("test.event", async (data) => {
      received.push(data);
    });

    await publishEvent("test.event", { foo: "bar" });

    // EventEmitter is synchronous so handler runs inline
    expect(received).toHaveLength(1);
    expect(received[0]).toMatchObject({ foo: "bar" });
  });

  it("attaches initiatorId from eventContext store", async () => {
    const received: Array<{ initiatorId?: string }> = [];

    await subscribeToEvent<{ initiatorId?: string }>(
      "test.initiator",
      async (data) => {
        received.push(data);
      },
    );

    await eventContext.run({ initiatorId: "user-abc" }, async () => {
      await publishEvent("test.initiator", { taskId: "t1" });
    });

    expect(received).toHaveLength(1);
    expect(received[0]?.initiatorId).toBe("user-abc");
  });

  it("sets initiatorId to undefined when no eventContext store exists", async () => {
    const received: Array<{ initiatorId?: string }> = [];

    await subscribeToEvent<{ initiatorId?: string }>(
      "test.no-context",
      async (data) => {
        received.push(data);
      },
    );

    await publishEvent("test.no-context", { taskId: "t2" });

    expect(received).toHaveLength(1);
    expect(received[0]?.initiatorId).toBeUndefined();
  });

  it("does not deliver events to unrelated subscribers", async () => {
    const received: unknown[] = [];

    await subscribeToEvent("other.event", async (data) => {
      received.push(data);
    });

    await publishEvent("test.unrelated", { value: 1 });

    expect(received).toHaveLength(0);
  });

  it("handles non-object data without attaching initiatorId", async () => {
    const received: unknown[] = [];

    await subscribeToEvent("test.primitive", async (data) => {
      received.push(data);
    });

    await publishEvent("test.primitive", "just a string");

    expect(received).toHaveLength(1);
    expect(received[0]).toBe("just a string");
  });

  it("shutdownEventBus removes all listeners", async () => {
    const received: unknown[] = [];

    await subscribeToEvent("test.shutdown", async (data) => {
      received.push(data);
    });

    await shutdownEventBus();
    await publishEvent("test.shutdown", { after: true });

    expect(received).toHaveLength(0);
  });
});
