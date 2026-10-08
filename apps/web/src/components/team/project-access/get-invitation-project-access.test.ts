import { describe, expect, it } from "vite-plus/test";
import { getInvitationProjectAccess } from "./get-invitation-project-access";

describe("getInvitationProjectAccess", () => {
  it("reads limited access from an invitation and defaults to every project", () => {
    expect(
      getInvitationProjectAccess({
        projectAccess: "selected",
        projectIds: ["p1"],
      }),
    ).toEqual({ projectAccess: "selected", projectIds: ["p1"] });
    expect(getInvitationProjectAccess({}).projectAccess).toBe("all");
    expect(
      getInvitationProjectAccess({ projectAccess: "all", projectIds: ["p1"] }),
    ).toEqual({ projectAccess: "all", projectIds: [] });
  });
});
