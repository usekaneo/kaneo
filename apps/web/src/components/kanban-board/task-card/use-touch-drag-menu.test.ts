import { act, renderHook } from "@testing-library/react";
import type { TouchEvent } from "react";
import { expect, it, vi } from "vite-plus/test";
import { useTouchDragMenu } from "./use-touch-drag-menu";

const card = document.createElement("div");

function touchAt(x: number, y: number, target: Node = card) {
  return {
    touches: [{ clientX: x, clientY: y }],
    target,
    currentTarget: card,
  } as unknown as TouchEvent<HTMLDivElement>;
}

function heldWithMenu(isDragging: boolean) {
  const view = renderHook(() => useTouchDragMenu(isDragging));
  act(() => {
    view.result.current.onTouchStart(touchAt(100, 100));
    view.result.current.setIsMenuOpen(true);
  });
  return view;
}

it("forwards touches on the card to the touch sensor", () => {
  const onDragTouchStart = vi.fn();
  const { result } = renderHook(() =>
    useTouchDragMenu(false, onDragTouchStart),
  );
  result.current.onTouchStart(touchAt(0, 0));
  expect(onDragTouchStart).toHaveBeenCalledOnce();
});

it("ignores touches from portaled content outside the card", () => {
  const onDragTouchStart = vi.fn();
  const { result } = renderHook(() =>
    useTouchDragMenu(false, onDragTouchStart),
  );
  result.current.onTouchStart(touchAt(0, 0, document.createElement("div")));
  expect(onDragTouchStart).not.toHaveBeenCalled();
});

it("closes the menu once a lifted card is moved", () => {
  const { result } = heldWithMenu(true);
  act(() => result.current.onTouchMove(touchAt(100, 115)));
  expect(result.current.isMenuOpen).toBe(false);
});

it("keeps the menu open while the finger stays within the tolerance", () => {
  const { result } = heldWithMenu(true);
  act(() => result.current.onTouchMove(touchAt(106, 94)));
  expect(result.current.isMenuOpen).toBe(true);
});

it("keeps the menu open when the card isn't being dragged", () => {
  const { result } = heldWithMenu(false);
  act(() => result.current.onTouchMove(touchAt(100, 160)));
  expect(result.current.isMenuOpen).toBe(true);
});
