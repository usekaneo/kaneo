import { describe, expect, it } from "vite-plus/test";
import { findMemberProjectAccess } from "./find-member-project-access";

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
