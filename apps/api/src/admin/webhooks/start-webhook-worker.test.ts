import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { sendWebhookDelivery } from "./send-webhook-delivery";
import { startWebhookWorker } from "./start-webhook-worker";

vi.mock("./send-webhook-delivery", () => ({ sendWebhookDelivery: vi.fn() }));

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("startWebhookWorker", () => {
  it("contains job failures without leaking their details and keeps processing", async () => {
    vi.useFakeTimers();
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(sendWebhookDelivery)
      .mockResolvedValue(false)
      .mockRejectedValueOnce(new Error("sensitive database parameters"));
    const stop = startWebhookWorker();
    try {
      await vi.advanceTimersByTimeAsync(0);
      expect(log).toHaveBeenCalledExactlyOnceWith(
        "Instance webhook delivery worker failed",
      );
      expect(sendWebhookDelivery).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(1_000);
      expect(sendWebhookDelivery).toHaveBeenCalledTimes(2);
    } finally {
      await stop();
    }
    await vi.advanceTimersByTimeAsync(1_000);
    expect(sendWebhookDelivery).toHaveBeenCalledTimes(2);
  });
});
