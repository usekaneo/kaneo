import { describe, expect, it } from "vite-plus/test";
import { resolveFeedLabels } from "./resolve-feed-labels";

describe("resolveFeedLabels", () => {
  it("keeps feed order and marks labels that no longer exist", () => {
    expect(
      resolveFeedLabels(
        ["design", "gone", "bug"],
        [
          { id: "bug", name: "Bug", color: "red" },
          { id: "design", name: "Design", color: "purple" },
        ],
      ),
    ).toEqual([
      { id: "design", name: "Design", color: "purple" },
      { id: "gone", name: null, color: "" },
      { id: "bug", name: "Bug", color: "red" },
    ]);
  });
});
