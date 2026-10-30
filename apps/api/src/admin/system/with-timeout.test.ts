import { describe, expect, it } from "vite-plus/test";
import { ProbeTimeoutError, withTimeout } from "./with-timeout";

describe("withTimeout", () => {
  it("runs a lazy thenable such as a Drizzle query only once", async () => {
    let runs = 0;
    const lazyQuery = {
      // oxlint-disable-next-line unicorn/no-thenable -- mimics a lazy query
      then(resolve: (value: string) => void, reject: (error: unknown) => void) {
        runs += 1;
        return Promise.resolve("rows").then(resolve, reject);
      },
    } as unknown as Promise<string>;

    await expect(withTimeout(() => lazyQuery, 50)).resolves.toBe("rows");
    expect(runs).toBe(1);
  });

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
