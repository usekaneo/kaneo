import { Result } from "effect";
import { describe, expect, it } from "vite-plus/test";
import {
  checkRole,
  isDemotion,
  needsCustomRoles,
  roleLabel,
  roleRank,
} from "./roles.js";

describe("checkRole", () => {
  it("accepts built-in roles without caring about case", () => {
    expect(checkRole(" Admin ", [])).toEqual(Result.succeed("admin"));
    expect(checkRole("viewer", [])).toEqual(Result.succeed("viewer"));
  });

  it("accepts custom roles of the workspace", () => {
    expect(checkRole("Contractor", ["contractor"])).toEqual(
      Result.succeed("contractor"),
    );
  });

  it("names the built-in roles when nothing matches", () => {
    const result = checkRole("boss", []);
    expect(Result.isFailure(result) && result.failure).toMatchObject({
      message: '"boss" is not a role in this workspace.',
      hint: "Use owner, admin, member or viewer.",
    });
  });

  it("lists custom roles in the hint without repeating built-in ones", () => {
    const result = checkRole("boss", ["member", "contractor", "auditor"]);
    expect(Result.isFailure(result) && result.failure.hint).toBe(
      "Use owner, admin, member, viewer, or a custom role: contractor, auditor.",
    );
  });

  it("refuses an empty role", () => {
    const result = checkRole("  ", []);
    expect(Result.isFailure(result) && result.failure.message).toBe(
      "A role is required.",
    );
  });
});

describe("needsCustomRoles", () => {
  it("only asks the server for roles that are not built in", () => {
    expect(needsCustomRoles("MEMBER")).toBe(false);
    expect(needsCustomRoles("contractor")).toBe(true);
  });
});

describe("isDemotion", () => {
  it("treats any change away from owner as a demotion", () => {
    expect(isDemotion("owner", "admin")).toBe(true);
    expect(isDemotion("owner", "owner")).toBe(false);
  });

  it("treats admin to a lower role as a demotion", () => {
    expect(isDemotion("admin", "member")).toBe(true);
    expect(isDemotion("admin", "contractor")).toBe(true);
    expect(isDemotion("admin", "owner")).toBe(false);
  });

  it("does not ask when changing other roles", () => {
    expect(isDemotion("member", "viewer")).toBe(false);
  });
});

describe("roleLabel and roleRank", () => {
  it("capitalizes each role in a list", () => {
    expect(roleLabel("admin,contractor")).toBe("Admin, Contractor");
  });

  it("orders owners first and viewers last", () => {
    const roles = ["viewer", "contractor", "member", "owner", "admin"];
    expect([...roles].sort((a, b) => roleRank(a) - roleRank(b))).toEqual([
      "owner",
      "admin",
      "member",
      "contractor",
      "viewer",
    ]);
  });
});
