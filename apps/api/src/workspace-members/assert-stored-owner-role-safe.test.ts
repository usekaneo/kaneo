import { describe, expect, it } from "vite-plus/test";
import { assertStoredOwnerRoleSafe } from "./assert-stored-owner-role-safe";

describe("stored ownership review", () => {
  it.each(["owner ", " owner", "member, owner", "member,\towner\n"])(
    "requires review instead of promoting %j on read",
    (role) => {
      expect(() => assertStoredOwnerRoleSafe(role)).toThrow();
    },
  );

  it.each([
    null,
    undefined,
    "member",
    "member, recruiter",
    "owner",
    "member,owner",
    "owner, owner",
  ])("preserves roles with no ambiguous ownership grant (%j)", (role) => {
    expect(() => assertStoredOwnerRoleSafe(role)).not.toThrow();
  });
});
