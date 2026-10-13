import { describe, expect, it } from "vite-plus/test";
import {
  applyOrder,
  moveItem,
  toPositions,
} from "@/components/project/sortable/apply-order";

const items = [{ id: "a" }, { id: "b" }, { id: "c" }];

describe("applyOrder", () => {
  it("returns the items unchanged without a pending order", () => {
    expect(applyOrder(items, null)).toBe(items);
  });

  it("sorts by the pending order and keeps unknown items last", () => {
    expect(
      applyOrder([...items, { id: "d" }], ["c", "a", "b"]).map(
        (item) => item.id,
      ),
    ).toEqual(["c", "a", "b", "d"]);
  });
});

describe("moveItem", () => {
  it("moves an item down and up", () => {
    expect(moveItem(["a", "b", "c"], 0, 2)).toEqual(["b", "c", "a"]);
    expect(moveItem(["a", "b", "c"], 2, 0)).toEqual(["c", "a", "b"]);
  });

  it("ignores an index outside the list", () => {
    const list = ["a"];
    expect(moveItem(list, 3, 0)).toBe(list);
  });
});

describe("toPositions", () => {
  it("numbers items from zero", () => {
    expect(toPositions(items)).toEqual([
      { id: "a", position: 0 },
      { id: "b", position: 1 },
      { id: "c", position: 2 },
    ]);
  });
});
