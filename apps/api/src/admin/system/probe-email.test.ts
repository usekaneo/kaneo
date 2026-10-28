import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { probeEmail } from "./probe-email";

vi.mock("@kaneo/email", () => ({
  verifySmtpConnection: () => new Promise(() => {}),
}));

describe("probeEmail", () => {
  afterEach(() => vi.useRealTimers());

  it("uses the probe deadline even when SMTP verification stalls", async () => {
    vi.useFakeTimers();
    let result: Awaited<ReturnType<typeof probeEmail>> | undefined;
    const pending = probeEmail(100).then((value) => {
      result = value;
    });

    await vi.advanceTimersByTimeAsync(100);

    expect(result).toMatchObject({ status: "down", errorCode: "TIMEOUT" });
    await pending;
  });
});
