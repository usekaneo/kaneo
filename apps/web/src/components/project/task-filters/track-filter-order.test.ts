import { describe, expect, it } from "vite-plus/test";
import { trackFilterOrder } from "./track-filter-order";

describe("trackFilterOrder", () => {
  it("appends newly active filters after the ones already active", () => {
    expect(trackFilterOrder(["priority"], ["status", "priority"])).toEqual([
      "priority",
      "status",
    ]);
  });

  it("drops filters that were cleared", () => {
    expect(
      trackFilterOrder(
        ["status", "labels", "priority"],
        ["priority", "status"],
      ),
    ).toEqual(["status", "priority"]);
  });

  it("starts from the given order", () => {
    expect(trackFilterOrder([], ["status", "assignee"])).toEqual([
      "status",
      "assignee",
    ]);
  });
});
