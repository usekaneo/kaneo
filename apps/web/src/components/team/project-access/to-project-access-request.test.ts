import { describe, expect, it } from "vite-plus/test";
import { toProjectAccessRequest } from "./to-project-access-request";

describe("toProjectAccessRequest", () => {
  it("clears project IDs when every project is allowed", () => {
    expect(
      toProjectAccessRequest({ projectAccess: "all", projectIds: ["p1"] }, [
        "p1",
      ]),
    ).toEqual({ projectAccess: "all", projectIds: [] });
  });

  it("keeps only unique projects the editor can see", () => {
    expect(
      toProjectAccessRequest(
        { projectAccess: "selected", projectIds: ["p1", "gone", "p1", "p2"] },
        ["p1", "p2"],
      ),
    ).toEqual({ projectAccess: "selected", projectIds: ["p1", "p2"] });
  });
});
