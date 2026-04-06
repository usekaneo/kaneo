import { describe, expect, it } from "vitest";
import type { BroadcastMessage } from "../../../apps/api/src/ws/broadcast-adapter";
import { InMemoryBroadcastAdapter } from "../../../apps/api/src/ws/in-memory-broadcast-adapter";

describe("InMemoryBroadcastAdapter", () => {
  it("delivers published messages to the subscribed handler", async () => {
    const adapter = new InMemoryBroadcastAdapter();
    const received: BroadcastMessage[] = [];

    await adapter.subscribe((msg) => {
      received.push(msg);
    });

    const message: BroadcastMessage = {
      projectId: "project-1",
      message: { type: "TASK_CREATED", projectId: "project-1", taskId: "t1" },
    };

    await adapter.publish(message);

    expect(received).toHaveLength(1);
    expect(received[0]).toEqual(message);
  });

  it("does not throw when publishing without a subscriber", async () => {
    const adapter = new InMemoryBroadcastAdapter();

    await expect(
      adapter.publish({
        projectId: "project-1",
        message: { type: "TASK_CREATED", projectId: "project-1" },
      }),
    ).resolves.toBeUndefined();
  });

  it("passes excludeInitiatorId through to the handler", async () => {
    const adapter = new InMemoryBroadcastAdapter();
    const received: BroadcastMessage[] = [];

    await adapter.subscribe((msg) => {
      received.push(msg);
    });

    await adapter.publish({
      projectId: "p1",
      message: { type: "TASK_UPDATED", projectId: "p1" },
      excludeInitiatorId: "user-abc",
    });

    expect(received[0]?.excludeInitiatorId).toBe("user-abc");
  });

  it("stops delivering messages after shutdown", async () => {
    const adapter = new InMemoryBroadcastAdapter();
    const received: BroadcastMessage[] = [];

    await adapter.subscribe((msg) => {
      received.push(msg);
    });

    await adapter.shutdown();

    await adapter.publish({
      projectId: "p1",
      message: { type: "TASK_DELETED", projectId: "p1" },
    });

    expect(received).toHaveLength(0);
  });

  it("replaces the handler when subscribe is called again", async () => {
    const adapter = new InMemoryBroadcastAdapter();
    const first: BroadcastMessage[] = [];
    const second: BroadcastMessage[] = [];

    await adapter.subscribe((msg) => first.push(msg));
    await adapter.subscribe((msg) => second.push(msg));

    await adapter.publish({
      projectId: "p1",
      message: { type: "TASK_UPDATED", projectId: "p1" },
    });

    expect(first).toHaveLength(0);
    expect(second).toHaveLength(1);
  });
});
