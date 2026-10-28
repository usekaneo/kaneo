import { renderHook } from "@testing-library/react";
import { expect, it } from "vite-plus/test";
import { useToolbarPresence } from "./use-toolbar-presence";

it("stays mounted after a selection clears and keeps the last count", () => {
  const { result, rerender } = renderHook(
    ({ count }) => useToolbarPresence(count),
    { initialProps: { count: 0 } },
  );
  expect(result.current.mounted).toBe(false);

  rerender({ count: 3 });
  expect(result.current).toEqual({
    mounted: true,
    hidden: false,
    displayCount: 3,
  });

  rerender({ count: 0 });
  expect(result.current).toEqual({
    mounted: true,
    hidden: true,
    displayCount: 3,
  });
});
