import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vite-plus/test";
import { useCompletionLinger } from "./use-completion-linger";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

it("lingers only after an active run finishes", () => {
  const { result, rerender } = renderHook(
    ({ active }) => useCompletionLinger(active, 700),
    { initialProps: { active: true } },
  );
  expect(result.current).toBe(false);

  rerender({ active: false });
  expect(result.current).toBe(true);

  act(() => vi.advanceTimersByTime(700));
  expect(result.current).toBe(false);
});

it("does not linger for a run that was already finished", () => {
  const { result } = renderHook(() => useCompletionLinger(false, 700));
  expect(result.current).toBe(false);
});
