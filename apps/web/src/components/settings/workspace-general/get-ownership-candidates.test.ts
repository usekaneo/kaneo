import { describe, expect, it } from "vite-plus/test";
import { getOwnershipCandidates } from "./get-ownership-candidates";

const members = [
  { id: "m1", role: "owner", userId: "u1" },
  { id: "m2", role: "admin", userId: "u2" },
  { id: "m3", role: "member", userId: "u3" },
];

describe("getOwnershipCandidates", () => {
  it("finds the owner and everyone else as candidates", () => {
    const result = getOwnershipCandidates(members, "u1");
    expect(result.currentOwner?.id).toBe("m1");
    expect(result.eligibleNewOwners.map((member) => member.id)).toEqual([
      "m2",
      "m3",
    ]);
  });

  it("never offers the current user", () => {
    const result = getOwnershipCandidates(members, "u2");
    expect(result.eligibleNewOwners.map((member) => member.id)).toEqual(["m3"]);
  });

  it("returns no candidates for a workspace with only the owner", () => {
    expect(
      getOwnershipCandidates([members[0]], "u1").eligibleNewOwners,
    ).toEqual([]);
  });
});
