import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import type { UserBroadcast } from "../../../apps/api/src/ws/broadcast-adapter";
import { createRevocationDelivery } from "../../../apps/api/src/ws/revocation-delivery";

describe("createRevocationDelivery", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("retries every ended session set of one user after Redis recovers", async () => {
    vi.useFakeTimers();
    let redisDown = true;
    const published: UserBroadcast[] = [];
    const delivery = createRevocationDelivery({
      async publishToUser(message) {
        if (redisDown) throw new Error("redis is down");
        published.push(message);
      },
    });
    try {
      for (const sessionIds of [["session-a"], ["session-b"]])
        await delivery.send({
          userId: "user-1",
          message: { type: "SESSIONS_ENDED", sessionIds },
        });
      await vi.advanceTimersByTimeAsync(0);
      expect(published).toEqual([]);

      redisDown = false;
      await vi.advanceTimersByTimeAsync(1_000);

      expect(published.map(({ message }) => message.sessionIds)).toEqual([
        ["session-a"],
        ["session-b"],
      ]);
    } finally {
      delivery.stop();
    }
  });
});
