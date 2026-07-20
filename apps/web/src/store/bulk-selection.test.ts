import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import useBulkSelectionStore from "./bulk-selection";

function resetBulkSelectionStore() {
  useBulkSelectionStore.setState({
    selectedTaskIds: new Set(),
    isSelectMode: false,
    availableTaskIds: [],
    focusedTaskId: null,
  });
}

describe("useBulkSelectionStore", () => {
  beforeEach(() => {
    resetBulkSelectionStore();
  });

  afterEach(() => {
    resetBulkSelectionStore();
  });

  it("does not notify subscribers when available task ids are unchanged", () => {
    const listener = vi.fn();
    const unsubscribe = useBulkSelectionStore.subscribe(listener);

    useBulkSelectionStore.getState().setAvailableTasks(["a", "b"]);
    expect(listener).toHaveBeenCalledTimes(1);

    // Same contents in a new array — must not re-notify, or list/board effects
    // that sync visibleTaskIds will hit Maximum update depth exceeded.
    useBulkSelectionStore.getState().setAvailableTasks(["a", "b"]);
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
  });

  it("does not notify subscribers when clearFocus is a no-op", () => {
    const listener = vi.fn();
    const unsubscribe = useBulkSelectionStore.subscribe(listener);

    useBulkSelectionStore.getState().clearFocus();
    expect(listener).not.toHaveBeenCalled();

    useBulkSelectionStore.getState().setFocusedTask("task-1");
    expect(listener).toHaveBeenCalledTimes(1);

    useBulkSelectionStore.getState().clearFocus();
    expect(listener).toHaveBeenCalledTimes(2);

    useBulkSelectionStore.getState().clearFocus();
    expect(listener).toHaveBeenCalledTimes(2);

    unsubscribe();
  });

  it("clears focus when the focused task leaves the available set", () => {
    useBulkSelectionStore.getState().setAvailableTasks(["parent", "child"]);
    useBulkSelectionStore.getState().setFocusedTask("child");

    useBulkSelectionStore.getState().setAvailableTasks(["parent"]);

    expect(useBulkSelectionStore.getState().focusedTaskId).toBeNull();
    expect(useBulkSelectionStore.getState().availableTaskIds).toEqual([
      "parent",
    ]);
  });

  it("keeps focus when the focused task remains available", () => {
    useBulkSelectionStore.getState().setAvailableTasks(["parent", "child"]);
    useBulkSelectionStore.getState().setFocusedTask("child");

    useBulkSelectionStore
      .getState()
      .setAvailableTasks(["parent", "child", "other"]);

    expect(useBulkSelectionStore.getState().focusedTaskId).toBe("child");
  });

  it("starts focusNext from the first available task after a stale focus", () => {
    useBulkSelectionStore.getState().setAvailableTasks(["a", "b", "c"]);
    useBulkSelectionStore.getState().setFocusedTask("gone");

    useBulkSelectionStore.getState().focusNext();

    expect(useBulkSelectionStore.getState().focusedTaskId).toBe("a");
  });
});
