import { beforeEach, describe, expect, it } from "vite-plus/test";
import useBacklogBulkSelectionStore from "./backlog-bulk-selection";
import useBulkSelectionStore from "./bulk-selection";

const stores = [
  ["board and list", useBulkSelectionStore],
  ["backlog", useBacklogBulkSelectionStore],
] as const;

describe.each(stores)("%s range selection", (_name, store) => {
  beforeEach(() => {
    store.setState(store.getInitialState());
    store.getState().setAvailableTasks(["a", "b", "c", "d", "e"]);
  });

  it("selects an inclusive range in either direction and keeps other selections", () => {
    store.getState().toggleSelection("a");
    store.getState().toggleSelection("d");
    store.getState().selectRange("b");
    expect([...store.getState().selectedTaskIds]).toEqual(["a", "d", "b", "c"]);

    store.getState().selectRange("e");
    expect(store.getState().selectedTaskIds).toEqual(
      new Set(["a", "b", "c", "d", "e"]),
    );
    expect(store.getState().selectionAnchorId).toBe("d");
  });

  it("uses a plain clicked task as the anchor and falls back to the clicked task when the anchor disappears", () => {
    store.getState().setSelectionAnchor("b");
    store.getState().selectRange("d");
    expect(store.getState().selectedTaskIds).toEqual(new Set(["b", "c", "d"]));

    store.getState().clearSelection();
    store.getState().setSelectionAnchor("b");
    store.getState().setAvailableTasks(["d", "e"]);
    store.getState().selectRange("e");
    expect(store.getState().selectedTaskIds).toEqual(new Set(["e"]));
    expect(store.getState().selectionAnchorId).toBe("e");
  });

  it("follows the current visible order after filtering or reordering", () => {
    store.getState().toggleSelection("a");
    store.getState().setAvailableTasks(["e", "a", "d", "c"]);
    store.getState().selectRange("c");
    expect(store.getState().selectedTaskIds).toEqual(new Set(["a", "d", "c"]));
    expect(store.getState().selectionAnchorId).toBe("a");
  });

  it("clears the anchor with the selection", () => {
    store.getState().toggleSelection("b");
    store.getState().clearSelection();
    store.getState().selectRange("d");
    expect(store.getState().selectedTaskIds).toEqual(new Set(["d"]));
  });
});
