import { describe, expect, it } from "vite-plus/test";
import { sortWorkspaceMembers } from "./sort-workspace-members";

describe("sortWorkspaceMembers", () => {
  it("lists owners first and keeps everyone else in order", () => {
    const members = [
      { id: "a", role: "member" },
      { id: "b", role: "owner" },
      { id: "c", role: "viewer" },
      { id: "d", role: "admin,owner" },
    ];

    expect(sortWorkspaceMembers(members).map((member) => member.id)).toEqual([
      "b",
      "d",
      "a",
      "c",
    ]);
    expect(members.map((member) => member.id)).toEqual(["a", "b", "c", "d"]);
  });
});
