import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import { renewWhileRunning } from "./renew-while-running";

function deferred<T>() {
  let resolve: (value: T) => void = () => {};
  let reject: (error: unknown) => void = () => {};
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("renewWhileRunning", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renews on every interval until the run resolves", async () => {
    const run = deferred<string>();
    const renew = vi.fn();
    const result = renewWhileRunning(() => run.promise, renew, 1000);

    await vi.advanceTimersByTimeAsync(999);
    expect(renew).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(renew).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(2000);
    expect(renew).toHaveBeenCalledTimes(3);

    run.resolve("done");
    await expect(result).resolves.toBe("done");
    await vi.advanceTimersByTimeAsync(5000);
    expect(renew).toHaveBeenCalledTimes(3);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("stops renewing when the run rejects", async () => {
    const run = deferred<void>();
    const renew = vi.fn();
    const result = renewWhileRunning(() => run.promise, renew, 1000);

    await vi.advanceTimersByTimeAsync(1000);
    run.reject(new Error("boom"));
    await expect(result).rejects.toThrow("boom");
    await vi.advanceTimersByTimeAsync(5000);
    expect(renew).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });
});
