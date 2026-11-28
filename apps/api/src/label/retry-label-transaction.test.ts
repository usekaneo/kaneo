import { expect, it, vi } from "vite-plus/test";
import { retryLabelTransaction } from "./retry-label-transaction";

const deadlock = () =>
  Object.assign(new Error("deadlock detected"), { code: "40P01" });

it("retries a rolled-back transaction when Drizzle wraps the deadlock", async () => {
  const run = vi
    .fn()
    .mockRejectedValueOnce(new Error("query failed", { cause: deadlock() }))
    .mockResolvedValue("committed");
  await expect(
    retryLabelTransaction(run, () => new Error("busy")),
  ).resolves.toBe("committed");
  expect(run).toHaveBeenCalledTimes(2);
});

it("bounds retries to three attempts and returns the caller's contention error", async () => {
  const busy = new Error("retry this request");
  const run = vi.fn().mockRejectedValue(deadlock());
  await expect(retryLabelTransaction(run, () => busy)).rejects.toBe(busy);
  expect(run).toHaveBeenCalledTimes(3);
});

it.each(["23514", "08006", "40001"])(
  "does not retry other failures (%s)",
  async (code) => {
    const failure = new Error("query failed", {
      cause: Object.assign(new Error("database error"), { code }),
    });
    const run = vi.fn().mockRejectedValue(failure);
    await expect(
      retryLabelTransaction(run, () => new Error("busy")),
    ).rejects.toBe(failure);
    expect(run).toHaveBeenCalledTimes(1);
  },
);
