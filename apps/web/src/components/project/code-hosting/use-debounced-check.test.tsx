import { act, renderHook } from "@testing-library/react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import { useDebouncedCheck } from "./use-debounced-check";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("useDebouncedCheck", () => {
  it("runs once the key settles and reports the result for that key only", async () => {
    const run = vi.fn(async () => "ok");
    const { result, rerender } = renderHook(
      ({ key }) => useDebouncedCheck(key, run, 300),
      { initialProps: { key: "a" as string | null } },
    );
    expect(result.current.checking).toBe(true);
    rerender({ key: "b" });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });
    expect(run).toHaveBeenCalledTimes(1);
    expect(result.current).toMatchObject({ checking: false, result: "ok" });
    rerender({ key: "c" });
    expect(result.current).toMatchObject({ checking: true, result: undefined });
  });

  it("does nothing without a key and exposes errors", async () => {
    const run = vi.fn(async () => {
      throw new Error("Denied");
    });
    const { result, rerender } = renderHook(
      ({ key }) => useDebouncedCheck(key, run, 300),
      { initialProps: { key: null as string | null } },
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });
    expect(run).not.toHaveBeenCalled();
    expect(result.current.checking).toBe(false);
    rerender({ key: "a" });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });
    expect(result.current.error).toEqual(new Error("Denied"));
  });
});
