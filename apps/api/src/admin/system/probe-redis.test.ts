import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { probeRedis } from "./probe-redis";

const subscriber = vi.hoisted(() => ({ status: "ready" }));
vi.mock("../../redis", () => ({
  isRedisConfigured: () => true,
  resolveRedisMode: () => ({ mode: "standalone" }),
  getRedisPub: () => ({ ping: async () => "PONG" }),
  getRedisSub: () => subscriber,
}));

describe("probeRedis", () => {
  afterEach(() => {
    subscriber.status = "ready";
  });

  it("reports a disconnected subscriber despite a healthy publisher", async () => {
    subscriber.status = "reconnecting";
    await expect(probeRedis(100)).resolves.toMatchObject({
      status: "down",
      errorCode: "SUBSCRIBER_NOT_READY",
    });
    subscriber.status = "ready";
    await expect(probeRedis(100)).resolves.toMatchObject({ status: "ok" });
  });
});
