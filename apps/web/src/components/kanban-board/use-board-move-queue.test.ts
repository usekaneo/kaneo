import { act, renderHook } from "@testing-library/react";
import { expect, it, vi } from "vite-plus/test";
import { type BoardMove, useBoardMoveQueue } from "./use-board-move-queue";

it("preserves the order and exact placement of quick follow-up drops", () => {
  const onMove = vi.fn((_move: BoardMove, onSettled: () => void) =>
    onSettled(),
  );
  const onCancel = vi.fn();
  const { result, rerender } = renderHook(
    ({ waiting }) =>
      useBoardMoveQueue({
        projectId: "p",
        waiting,
        disabled: false,
        onMove,
        onCancel,
      }),
    { initialProps: { waiting: true } },
  );
  const first = { activeId: "a", overId: "b", insertAfterTarget: false };
  const second = { activeId: "c", overId: "d", insertAfterTarget: true };
  act(() => {
    result.current.queueMove(first);
    result.current.queueMove(second);
  });

  expect(onMove).not.toHaveBeenCalled();
  rerender({ waiting: false });
  expect(onMove.mock.calls.map(([move]) => move)).toEqual([
    { ...first, projectId: "p" },
    { ...second, projectId: "p" },
  ]);
  expect(onCancel).not.toHaveBeenCalled();
});

it("waits for each save even before the mutation's pending state renders", () => {
  const onMove = vi.fn();
  const { result } = renderHook(() =>
    useBoardMoveQueue({
      projectId: "p",
      waiting: false,
      disabled: false,
      onMove,
      onCancel: vi.fn(),
    }),
  );
  act(() => {
    result.current.queueMove({ activeId: "a", overId: "b" });
    result.current.queueMove({ activeId: "c", overId: "d" });
  });
  expect(onMove).toHaveBeenCalledOnce();
  act(() => onMove.mock.calls[0][1]());
  expect(onMove).toHaveBeenCalledTimes(2);
});

it("applies an idle drop synchronously before the drag preview is cleared", () => {
  const onMove = vi.fn();
  const { result } = renderHook(() =>
    useBoardMoveQueue({
      projectId: "p",
      waiting: false,
      disabled: false,
      onMove,
      onCancel: vi.fn(),
    }),
  );
  act(() => {
    result.current.queueMove({ activeId: "a", overId: "b" });
    expect(onMove).toHaveBeenCalledOnce();
  });
});

it.each(["disabled", "project"] as const)(
  "reports and clears queued moves when %s changes",
  (change) => {
    const onMove = vi.fn();
    const onCancel = vi.fn();
    const { result, rerender } = renderHook(
      ({ projectId, disabled, waiting }) =>
        useBoardMoveQueue({
          projectId,
          disabled,
          waiting,
          onMove,
          onCancel,
        }),
      {
        initialProps: {
          projectId: "p",
          disabled: false,
          waiting: true,
        },
      },
    );
    act(() => result.current.queueMove({ activeId: "a", overId: "b" }));
    rerender({
      projectId: change === "project" ? "other" : "p",
      disabled: change === "disabled",
      waiting: true,
    });
    expect(onCancel).toHaveBeenCalledOnce();
    rerender({ projectId: "p", disabled: false, waiting: false });
    expect(onMove).not.toHaveBeenCalled();
  },
);
