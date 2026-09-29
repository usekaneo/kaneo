import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { createDescriptionSaveQueue } from "./description-save-queue";

afterEach(() => vi.useRealTimers());

describe("description save queue", () => {
  it("serializes requests and coalesces edits made while a save is running", async () => {
    vi.useFakeTimers();
    let finish!: () => void;
    const save = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<void>((resolve) => {
            finish = resolve;
          }),
      )
      .mockResolvedValue(undefined);
    const queue = createDescriptionSaveQueue(10);
    queue.schedule("task", "old", save);
    await vi.advanceTimersByTimeAsync(10);
    queue.schedule("task", "middle", save);
    queue.schedule("task", "newest", save);
    await vi.advanceTimersByTimeAsync(20);
    expect(save.mock.calls).toEqual([["old"]]);
    finish();
    await Promise.resolve();
    await Promise.resolve();
    expect(save.mock.calls).toEqual([["old"], ["newest"]]);
    expect(queue.get("task")).toBeUndefined();
  });

  it("retains failed content for a visible retry and keeps task queues independent", async () => {
    vi.useFakeTimers();
    const save = vi
      .fn()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValue(undefined);
    const queue = createDescriptionSaveQueue(10);
    queue.schedule("a", "unsaved", save);
    queue.schedule("b", "other", vi.fn().mockResolvedValue(undefined));
    await vi.advanceTimersByTimeAsync(10);
    expect(queue.get("a")).toMatchObject({ value: "unsaved", state: "failed" });
    expect(queue.get("b")).toBeUndefined();
    queue.retry("a");
    await Promise.resolve();
    expect(save.mock.calls).toEqual([["unsaved"], ["unsaved"]]);
    expect(queue.get("a")).toBeUndefined();
  });
});
