import { describe, expect, it } from "vite-plus/test";
import { realtimeStatus } from "./realtime-status";

describe("realtimeStatus", () => {
  it("is healthy on a single instance without Redis", () => {
    expect(
      realtimeStatus({ adapter: "in-memory", redisStatus: "not_configured" }),
    ).toBe("ok");
  });

  it("is healthy when Redis fan-out answers", () => {
    expect(realtimeStatus({ adapter: "redis", redisStatus: "ok" })).toBe("ok");
  });

  it("warns when Redis fan-out is down but local sockets still work", () => {
    expect(realtimeStatus({ adapter: "redis", redisStatus: "down" })).toBe(
      "warning",
    );
  });

  it("is down before the WebSocket adapter starts", () => {
    expect(
      realtimeStatus({ adapter: null, redisStatus: "not_configured" }),
    ).toBe("down");
  });
});
