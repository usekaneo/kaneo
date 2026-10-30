import { describe, expect, it } from "vite-plus/test";
import { getPrimaryInstanceRole } from "./get-primary-instance-role";

describe("getPrimaryInstanceRole", () => {
  it.each([
    ["user,admin", "admin"],
    ["user,support", "support"],
    ["user", "user"],
    [null, "user"],
    ["", "user"],
  ])("reads %s as %s", (role, expected) => {
    expect(getPrimaryInstanceRole(role)).toBe(expected);
  });
});
