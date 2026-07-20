import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import useBulkSelectionStore from "@/store/bulk-selection";
import useHierarchyExpansionStore, {
  EMPTY_EXPANDED_IDS,
} from "@/store/hierarchy-expansion";

/**
 * Regression for production React #185 (Maximum update depth exceeded) on /board.
 *
 * List view synced `visibleTaskIds` into the bulk-selection store on every
 * effect run. Unstable `?? []` hierarchy selectors plus unconditional store
 * writes re-triggered that effect forever.
 */
describe("board list hierarchy update-loop regression", () => {
  beforeEach(() => {
    useBulkSelectionStore.setState({
      selectedTaskIds: new Set(),
      isSelectMode: false,
      availableTaskIds: [],
      focusedTaskId: null,
    });
    useHierarchyExpansionStore.setState({ expandedTaskIds: {} });
    window.localStorage.removeItem("hierarchy-expansion");
  });

  afterEach(() => {
    useBulkSelectionStore.setState({
      selectedTaskIds: new Set(),
      isSelectMode: false,
      availableTaskIds: [],
      focusedTaskId: null,
    });
    useHierarchyExpansionStore.setState({ expandedTaskIds: {} });
    window.localStorage.removeItem("hierarchy-expansion");
  });

  it("keeps hierarchy empty-ids and available-tasks stable across repeated syncs", () => {
    const projectId = "project-1";
    const visibleTaskIds = ["task-a", "task-b"];

    const { result } = renderHook(() => {
      const expandedIds = useHierarchyExpansionStore(
        (state) => state.expandedTaskIds[projectId] ?? EMPTY_EXPANDED_IDS,
      );
      const availableTaskIds = useBulkSelectionStore(
        (state) => state.availableTaskIds,
      );
      return { expandedIds, availableTaskIds };
    });

    const listener = vi.fn();
    const unsubscribe = useBulkSelectionStore.subscribe(listener);

    act(() => {
      useBulkSelectionStore.getState().setAvailableTasks(visibleTaskIds);
    });
    expect(listener).toHaveBeenCalledTimes(1);
    const expandedAfterFirst = result.current.expandedIds;

    act(() => {
      // Mimic list-view effect re-running with a freshly allocated ids array
      // after a render that re-read the hierarchy selector.
      useBulkSelectionStore.getState().setAvailableTasks([...visibleTaskIds]);
    });

    expect(listener).toHaveBeenCalledTimes(1);
    expect(result.current.expandedIds).toBe(expandedAfterFirst);
    expect(result.current.expandedIds).toBe(EMPTY_EXPANDED_IDS);
    expect(result.current.availableTaskIds).toEqual(visibleTaskIds);

    unsubscribe();
  });
});
