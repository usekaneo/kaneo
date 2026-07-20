import { afterEach, beforeEach, describe, expect, it } from "vitest";
import useHierarchyExpansionStore, {
  EMPTY_EXPANDED_IDS,
} from "./hierarchy-expansion";

function resetHierarchyExpansionStore() {
  useHierarchyExpansionStore.setState({ expandedTaskIds: {} });
  window.localStorage.removeItem("hierarchy-expansion");
}

describe("useHierarchyExpansionStore", () => {
  beforeEach(() => {
    resetHierarchyExpansionStore();
  });

  afterEach(() => {
    resetHierarchyExpansionStore();
  });

  it("returns a stable empty reference for projects without expansions", () => {
    // Guards against `?? []`, which allocates a new array on every selector
    // read and can retrigger list-view effects into an infinite update loop.
    const selectExpandedIds = (
      state: ReturnType<typeof useHierarchyExpansionStore.getState>,
    ) => state.expandedTaskIds["project-missing"] ?? EMPTY_EXPANDED_IDS;

    const first = selectExpandedIds(useHierarchyExpansionStore.getState());
    const second = selectExpandedIds(useHierarchyExpansionStore.getState());

    expect(first).toBe(EMPTY_EXPANDED_IDS);
    expect(second).toBe(first);
    expect(first).toEqual([]);
  });

  it("toggles expansion for a project", () => {
    useHierarchyExpansionStore.getState().toggleExpanded("project-1", "task-1");

    expect(
      useHierarchyExpansionStore.getState().isExpanded("project-1", "task-1"),
    ).toBe(true);

    useHierarchyExpansionStore.getState().toggleExpanded("project-1", "task-1");

    expect(
      useHierarchyExpansionStore.getState().isExpanded("project-1", "task-1"),
    ).toBe(false);
  });

  it("collapseAll clears expanded tasks for the project", () => {
    useHierarchyExpansionStore
      .getState()
      .expandAll("project-1", ["task-1", "task-2"]);
    useHierarchyExpansionStore.getState().collapseAll("project-1");

    expect(
      useHierarchyExpansionStore.getState().expandedTaskIds["project-1"],
    ).toEqual([]);
    expect(
      useHierarchyExpansionStore.getState().isExpanded("project-1", "task-1"),
    ).toBe(false);
  });
});
