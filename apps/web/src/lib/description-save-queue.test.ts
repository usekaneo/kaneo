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

it("sends a newer pending edit even when the older request fails", async () => {
  vi.useFakeTimers();
  let fail!: (error: Error) => void;
  const save = vi
    .fn()
    .mockImplementationOnce(
      () =>
        new Promise((_resolve, reject) => {
          fail = reject;
        }),
    )
    .mockResolvedValue(undefined);
  const queue = createDescriptionSaveQueue(10);
  queue.schedule("task", "old", save);
  await vi.advanceTimersByTimeAsync(10);
  queue.schedule("task", "new", save);
  await vi.advanceTimersByTimeAsync(10);
  fail(new Error("offline"));
  await vi.advanceTimersByTimeAsync(0);
  expect(save.mock.calls).toEqual([["old"], ["new"]]);
  expect(queue.get("task")).toBeUndefined();
});
it("isolates owners and prevents a cleared in-flight request from draining another user's drafts", async () => {
  vi.useFakeTimers();
  let finish!: () => void;
  const oldSave = vi.fn(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
  );
  const newSave = vi.fn().mockResolvedValue(undefined);
  const queue = createDescriptionSaveQueue(10);
  queue.schedule("task", "private draft", oldSave, "alice");
  await vi.advanceTimersByTimeAsync(10);
  queue.schedule("task", "pending private draft", oldSave, "alice");
  expect(queue.get("task", "bob")).toBeUndefined();
  queue.clear();
  queue.schedule("task", "bob's edit", newSave, "bob");
  finish();
  await vi.advanceTimersByTimeAsync(10);
  expect(oldSave).toHaveBeenCalledTimes(1);
  expect(newSave).toHaveBeenCalledExactlyOnceWith("bob's edit");
  expect(queue.get("task", "alice")).toBeUndefined();
});

it("drains an unexpired debounce before sign-out and retains a failed drain for retry", async () => {
  vi.useFakeTimers();
  const queue = createDescriptionSaveQueue(700);
  const save = vi.fn().mockResolvedValue(undefined);
  queue.schedule("task", "recent edit", save, "alice");
  expect(await queue.drain("alice")).toBe(true);
  expect(save).toHaveBeenCalledExactlyOnceWith("recent edit");
  const failing = vi.fn().mockRejectedValue(new Error("offline"));
  queue.schedule("task", "unsaved edit", failing, "alice");
  expect(await queue.drain("alice")).toBe(false);
  expect(queue.get("task", "alice")).toMatchObject({
    value: "unsaved edit",
    state: "failed",
  });
  queue.clear();
});
