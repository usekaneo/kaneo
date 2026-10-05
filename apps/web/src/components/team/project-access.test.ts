import { describe, expect, it } from "vite-plus/test";
import {
  findMemberProjectAccess,
  getInvitationProjectAccess,
  isProjectAccessComplete,
  toggleProjectId,
  toProjectAccessRequest,
} from "./project-access";

describe("toggleProjectId", () => {
  it("adds a checked project once and removes an unchecked one", () => {
    expect(toggleProjectId(["a"], "b", true)).toEqual(["a", "b"]);
    expect(toggleProjectId(["a", "b"], "b", true)).toEqual(["a", "b"]);
    expect(toggleProjectId(["a", "b"], "a", false)).toEqual(["b"]);
  });
});

describe("findMemberProjectAccess", () => {
  it("treats members missing from the restricted list as having every project", () => {
    expect(findMemberProjectAccess([], "user-1")).toEqual({
      projectAccess: "all",
      projectIds: [],
    });
    expect(findMemberProjectAccess(undefined, "user-1").projectAccess).toBe(
      "all",
    );
  });

  it("returns the selected projects of a restricted member", () => {
    expect(
      findMemberProjectAccess(
        [{ userId: "user-1", projectIds: ["p1", "p2"] }],
        "user-1",
      ),
    ).toEqual({ projectAccess: "selected", projectIds: ["p1", "p2"] });
  });
});

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

describe("isProjectAccessComplete", () => {
  it("requires at least one project when access is limited", () => {
    expect(
      isProjectAccessComplete({ projectAccess: "all", projectIds: [] }),
    ).toBe(true);
    expect(
      isProjectAccessComplete({ projectAccess: "selected", projectIds: [] }),
    ).toBe(false);
    expect(
      isProjectAccessComplete({ projectAccess: "selected", projectIds: ["p"] }),
    ).toBe(true);
  });
});
