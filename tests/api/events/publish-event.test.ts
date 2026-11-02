import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import {
  eventContext,
  publishEvent,
  shutdownEventBus,
  subscribeToEvent,
  type EventPayload,
} from "../../../apps/api/src/events/index";

describe("publishEvent / subscribeToEvent", () => {
  it("shares one publication identity between subscribers without replacing provider IDs", async () => {
    const received: EventPayload<{ eventId: string }>[] = [];
    const collect = async (
      _data: { eventId: string },
      event: EventPayload<{ eventId: string }>,
    ) => {
      received.push(event);
    };
    await subscribeToEvent("test.identity", collect);
    await subscribeToEvent("test.identity", collect);
    await publishEvent(
      "test.identity",
      { eventId: "provider-receipt" },
      { waitForHandlers: true },
    );

    expect(received).toHaveLength(2);
    expect(received[0]).toBe(received[1]);
    expect(received[0]!.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(received[0]!.data.eventId).toBe("provider-receipt");
  });

  it("distinguishes publications with identical data and timestamps", async () => {
    const received: EventPayload[] = [];
    await subscribeToEvent("test.repeated", async (_data, event) => {
      received.push(event);
    });
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
      const data = { taskId: "task", newStatus: "in-review" };
      await publishEvent("test.repeated", data, { waitForHandlers: true });
      await publishEvent("test.repeated", data, { waitForHandlers: true });
      expect(received).toHaveLength(2);
      expect(received[0]!.timestamp).toBe(received[1]!.timestamp);
      expect(received[0]!.id).not.toBe(received[1]!.id);
    } finally {
      vi.useRealTimers();
    }
  });

  it("awaits subscriber completion in sequence when requested", async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const calls: string[] = [];
    await subscribeToEvent("test.bounded", async () => {
      calls.push("first-start");
      await gate;
      calls.push("first-end");
    });
    await subscribeToEvent("test.bounded", async () => {
      calls.push("second");
    });
    let completed = false;
    const operation = publishEvent(
      "test.bounded",
      {},
      { waitForHandlers: true },
    ).then(() => {
      completed = true;
    });
    expect(calls).toEqual(["first-start"]);
    expect(completed).toBe(false);
    release();
    await operation;
    expect(calls).toEqual(["first-start", "first-end", "second"]);
  });

  it("keeps best-effort error isolation for awaited subscribers", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const next = vi.fn(async () => {});
    try {
      await subscribeToEvent("test.failure", async () => {
        throw new Error("subscriber failed");
      });
      await subscribeToEvent("test.failure", next);
      await publishEvent("test.failure", {}, { waitForHandlers: true });
      expect(next).toHaveBeenCalledTimes(1);
      expect(log).toHaveBeenCalledTimes(1);
    } finally {
      log.mockRestore();
    }
  });
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
    expect(received[0]).toMatchObject({
      taskId: "t1",
      initiatorId: "user-abc",
    });
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
