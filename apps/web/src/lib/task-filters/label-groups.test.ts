import { describe, expect, it } from "vite-plus/test";
import {
  groupLabels,
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
});
