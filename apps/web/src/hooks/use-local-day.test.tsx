import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { useLocalDay } from "./use-local-day";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("useLocalDay", () => {
  it("advances at local midnight without task data changing", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2030, 0, 1, 23, 59, 59));
    const { result } = renderHook(useLocalDay);
    expect(result.current).toBe(new Date(2030, 0, 1).getTime());
    act(() => vi.advanceTimersByTime(1000));
    expect(result.current).toBe(new Date(2030, 0, 2).getTime());
    act(() => vi.advanceTimersByTime(24 * 60 * 60 * 1000));
    expect(result.current).toBe(new Date(2030, 0, 3).getTime());
  });

  it("catches up when a suspended tab regains focus and clears its timer", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2030, 0, 1, 12));
    const { result, unmount } = renderHook(useLocalDay);
    vi.setSystemTime(new Date(2030, 0, 4, 12));
    act(() => window.dispatchEvent(new Event("focus")));
    expect(result.current).toBe(new Date(2030, 0, 4).getTime());
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
