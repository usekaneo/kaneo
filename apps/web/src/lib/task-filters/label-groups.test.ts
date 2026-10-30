import { describe, expect, it } from "vite-plus/test";
import {
  groupLabels,
  expandLabelFilter,
  isLabelGroupSelected,
  toggleLabelGroup,
} from "./label-groups";

const labels = [
  { id: "a1", name: "Design", color: "pink" },
  { id: "a2", name: "Design", color: "pink" },
  { id: "b1", name: "Engineering", color: "blue" },
];
const design = labels[0];

describe("label groups", () => {
  it("collapses labels that share a name and color", () => {
    expect(groupLabels(labels).map((label) => label.id)).toEqual(["a1", "b1"]);
  });

  it("selects and clears every label in a group together", () => {
    const selected = toggleLabelGroup(labels, design, ["b1"]);
    expect(selected).toEqual(["b1", "a1", "a2"]);
    expect(isLabelGroupSelected(labels, design, selected)).toBe(true);
    expect(toggleLabelGroup(labels, design, selected)).toEqual(["b1"]);
    expect(toggleLabelGroup(labels, design, ["a2"])).toBeNull();
  });

  it("includes label assignments added after the filter was saved", () => {
    const attached = { ...design, id: "new-assignment" };
    expect(expandLabelFilter([...labels, attached], ["a1"])).toEqual([
      "a1",
      "a2",
      "new-assignment",
    ]);
  });

  it("keeps differently named or colored groups separate", () => {
    const other = { ...design, id: "different-color", color: "red" };
    expect(expandLabelFilter([...labels, other], ["a1"])).toEqual(["a1", "a2"]);
  });

  it("follows current metadata after a selected label is renamed", () => {
    const renamed = labels.map((label) => ({ ...label, name: "Renamed" }));
    expect(expandLabelFilter(renamed, ["a1"])).toEqual(["a1", "a2"]);
  });

  it("does not broaden a filter whose selected labels no longer exist", () => {
    expect(expandLabelFilter(labels, ["deleted"])).toEqual(["deleted"]);
    expect(expandLabelFilter(labels, null)).toBeNull();
  });

  it("groups, selects, expands and clears mixed-case colors consistently", () => {
    const lower = { ...design, id: "lower", color: "#bb87fc" };
    const upper = { ...lower, id: "upper", color: "#BB87FC" };
    const mixed = [lower, upper, labels[2]];
    expect(groupLabels(mixed)).toEqual([lower, labels[2]]);
    for (const selected of [lower, upper]) {
      expect(isLabelGroupSelected(mixed, lower, [selected.id])).toBe(true);
      expect(expandLabelFilter(mixed, [selected.id])).toEqual(
        expect.arrayContaining([lower.id, upper.id]),
      );
      expect(toggleLabelGroup(mixed, upper, [selected.id])).toBeNull();
    }
  });

  it("retains a legacy snapshot when some assignments have been deleted", () => {
    expect(expandLabelFilter(labels, ["deleted", "a2"])).toEqual([
      "deleted",
      "a2",
      "a1",
    ]);
  });
});
