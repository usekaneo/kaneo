import { describe, expect, it } from "vite-plus/test";
import { ProbeTimeoutError, withTimeout } from "./with-timeout";

describe("withTimeout", () => {
  it("returns the result when the work finishes in time", async () => {
    await expect(withTimeout(async () => "ok", 50)).resolves.toBe("ok");
  });

  it("passes the work's own error through", async () => {
    await expect(
      withTimeout(async () => {
        throw new Error("boom");
      }, 50),
    ).rejects.toThrow("boom");
  });

  it("rejects and aborts the work when it takes too long", async () => {
    let aborted = false;
    const result = withTimeout(
      (signal) =>
        new Promise((_, reject) => {
          signal.addEventListener("abort", () => {
            aborted = true;
            reject(new Error("late failure"));
          });
        }),
      10,
    );
    await expect(result).rejects.toBeInstanceOf(ProbeTimeoutError);
    expect(aborted).toBe(true);
  });
});
