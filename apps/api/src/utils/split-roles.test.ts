import { describe, expect, it } from "vite-plus/test";
import { splitRoles } from "./split-roles";

describe("splitRoles", () => {
  it("returns a single role as a one-item list", () => {
    expect(splitRoles("member")).toEqual(["member"]);
  });

  it("splits comma-separated roles", () => {
    expect(splitRoles("owner,viewer")).toEqual(["owner", "viewer"]);
  });

  it("trims names and drops empty and repeated entries", () => {
    expect(splitRoles(" member , ,viewer,member,")).toEqual([
      "member",
      "viewer",
    ]);
  });

  it("never grants ownership by trimming a stored token", () => {
    for (const role of [
      " owner",
      "owner ",
      "member, owner",
      "member,\towner\n",
    ]) {
      expect(splitRoles(role)).not.toContain("owner");
    }
    expect(splitRoles("member, owner,owner")).toEqual(["member", "owner"]);
  });

  it("returns an empty list for a missing or blank role", () => {
    expect(splitRoles(null)).toEqual([]);
    expect(splitRoles(undefined)).toEqual([]);
    expect(splitRoles(" , ")).toEqual([]);
  });
});
