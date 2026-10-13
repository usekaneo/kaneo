import { cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { useBulkSelectionKeys } from "./use-bulk-selection-keys";

afterEach(() => {
  cleanup();
  document.body.innerHTML = "";
});

const press = (target: Element, init: KeyboardEventInit) =>
  target.dispatchEvent(
    new KeyboardEvent("keydown", { bubbles: true, cancelable: true, ...init }),
  );

describe("useBulkSelectionKeys", () => {
  it("clears the selection on Escape outside popups", () => {
    const clearSelection = vi.fn();
    renderHook(() =>
      useBulkSelectionKeys({
        hasSelection: true,
        selectAll: vi.fn(),
        clearSelection,
      }),
    );
    press(document.body, { key: "Escape" });
    expect(clearSelection).toHaveBeenCalledTimes(1);
  });

  it("lets Escape through when nothing is selected", () => {
    const clearSelection = vi.fn();
    renderHook(() =>
      useBulkSelectionKeys({
        hasSelection: false,
        selectAll: vi.fn(),
        clearSelection,
      }),
    );
    const event = new KeyboardEvent("keydown", {
      key: "Escape",
      bubbles: true,
      cancelable: true,
    });
    document.body.dispatchEvent(event);
    expect(clearSelection).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
  });

  it("leaves the selection alone when Escape closes a menu or popover", () => {
    const clearSelection = vi.fn();
    renderHook(() =>
      useBulkSelectionKeys({
        hasSelection: true,
        selectAll: vi.fn(),
        clearSelection,
      }),
    );
    document.body.innerHTML =
      '<div role="dialog"><input /></div><div role="menu"><button>x</button></div>';
    press(document.querySelector("input") as Element, { key: "Escape" });
    press(document.querySelector("button") as Element, { key: "Escape" });
    expect(clearSelection).not.toHaveBeenCalled();
  });

  it("selects all with the modifier key unless the person is typing", () => {
    const selectAll = vi.fn();
    renderHook(() =>
      useBulkSelectionKeys({
        hasSelection: false,
        selectAll,
        clearSelection: vi.fn(),
      }),
    );
    document.body.innerHTML = "<input />";
    press(document.querySelector("input") as Element, {
      key: "a",
      metaKey: true,
    });
    expect(selectAll).not.toHaveBeenCalled();
    press(document.body, { key: "a", ctrlKey: true });
    expect(selectAll).toHaveBeenCalledTimes(1);
    press(document.body, { key: "a", ctrlKey: true, altKey: true });
    expect(selectAll).toHaveBeenCalledTimes(1);
  });
});
