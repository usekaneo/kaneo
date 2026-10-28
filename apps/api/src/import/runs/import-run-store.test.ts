import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import { createImportRunStore } from "./import-run-store";
import type { RunChanges } from "./update-running-run";

const RESULT: RunChanges = {
  status: "completed",
  error: null,
  message: null,
  finishedAt: new Date("2026-10-01T10:00:00.000Z"),
};

function databaseDown() {
  return Object.assign(new Error("connection terminated"), {
    code: "57P01",
  });
}

describe("createImportRunStore", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("keeps going when a progress write fails", async () => {
    const writeRun = vi
      .fn<(runId: string, changes: RunChanges) => Promise<boolean>>()
      .mockRejectedValueOnce(databaseDown())
      .mockResolvedValue(true);
    const store = createImportRunStore("run-1", { writeRun });

    await store.save({ message: "Reading cards" });
    await store.save({ message: "Saving" });

    expect(writeRun).toHaveBeenCalledTimes(2);
    expect(store.isDetached()).toBe(false);
  });

  it("retries the final status with a short backoff", async () => {
    const writeRun = vi
      .fn<(runId: string, changes: RunChanges) => Promise<boolean>>()
      .mockRejectedValueOnce(databaseDown())
      .mockRejectedValueOnce(databaseDown())
      .mockResolvedValue(true);
    const store = createImportRunStore("run-1", { writeRun });

    const finished = store.finish(RESULT);
    await vi.advanceTimersByTimeAsync(0);
    expect(writeRun).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(500);
    expect(writeRun).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(2_000);
    await finished;

    expect(writeRun).toHaveBeenCalledTimes(3);
    expect(writeRun).toHaveBeenLastCalledWith("run-1", RESULT);
    expect(console.error).not.toHaveBeenCalled();
  });

  it("logs the final failure without the error message", async () => {
    const writeRun = vi.fn(async () => {
      throw databaseDown();
    });
    const store = createImportRunStore("run-1", { writeRun });

    const finished = store.finish(RESULT);
    await vi.advanceTimersByTimeAsync(2_500);
    await finished;

    expect(writeRun).toHaveBeenCalledTimes(3);
    expect(console.error).toHaveBeenCalledTimes(1);
    expect(console.error).toHaveBeenCalledWith(
      "Failed to save the import result",
      { runId: "run-1", error: "Error", code: "57P01", constraint: undefined },
    );
  });

  it("stops writing once the run was settled elsewhere", async () => {
    const writeRun = vi.fn(async () => false);
    const store = createImportRunStore("run-1", { writeRun });

    await store.save({ message: "Reading cards" });
    await store.finish(RESULT);

    expect(writeRun).toHaveBeenCalledTimes(1);
    expect(store.isDetached()).toBe(true);
  });
});
