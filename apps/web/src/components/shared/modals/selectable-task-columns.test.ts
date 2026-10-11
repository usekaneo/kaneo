import { describe, expect, it } from "vite-plus/test";
import { getInitialTaskColumn } from "./initial-task-column";
import { getSelectableTaskColumns } from "./selectable-task-columns";

describe("getSelectableTaskColumns", () => {
  it("keeps unique columns, including completed columns, in workflow order", () => {
    const columns = [
      { slug: "ready", isFinal: false },
      { slug: "finished", isFinal: true },
    ];
    expect(getSelectableTaskColumns(columns)).toEqual(columns);
    expect(getInitialTaskColumn(columns)).toBe(columns[0]);
  });

  it("excludes every column with an ambiguous legacy slug", () => {
    const columns = [
      { slug: "shared", isFinal: false },
      { slug: "shared", isFinal: true },
      { slug: "ready", isFinal: false },
    ];
    expect(getSelectableTaskColumns(columns)).toEqual([columns[2]]);
    expect(getInitialTaskColumn(columns)).toBe(columns[2]);
  });

  it("handles absent or empty workflows", () => {
    expect(getSelectableTaskColumns(undefined)).toEqual([]);
    expect(getSelectableTaskColumns([])).toEqual([]);
    expect(getInitialTaskColumn(undefined)).toBeUndefined();
  });
});
