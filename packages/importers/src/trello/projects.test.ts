import { describe, expect, it } from "vite-plus/test";
import { mapBoardSummaries } from "./projects.js";

describe("mapBoardSummaries", () => {
  it("names the workspace or Personal and sorts by board name", () => {
    expect(
      mapBoardSummaries(
        [
          { id: "b2", name: "Zeta", idOrganization: "o1" },
          { id: "b1", name: "alpha", idOrganization: null },
          { id: "b3", name: "Mid", idOrganization: "o-guest" },
        ],
        [{ id: "o1", displayName: "Acme" }],
      ),
    ).toEqual([
      { id: "b1", name: "alpha", detail: "Personal" },
      { id: "b3", name: "Mid" },
      { id: "b2", name: "Zeta", detail: "Acme" },
    ]);
  });
});
