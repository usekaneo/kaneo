import { describe, expect, it } from "vitest";
import { hasInstanceAdminRole, withInstanceAdminRole } from "./instance-admin";

describe("hasInstanceAdminRole", () => {
  it("accepts a plain admin role", () => {
    expect(hasInstanceAdminRole("admin")).toBe(true);
  });

  it("accepts admin inside a comma-separated role list", () => {
    expect(hasInstanceAdminRole("user,admin")).toBe(true);
  });

  it("does not trim tokens", () => {
    expect(hasInstanceAdminRole(" admin , user")).toBe(false);
  });

  it("rejects roles without admin", () => {
    expect(hasInstanceAdminRole("user")).toBe(false);
    expect(hasInstanceAdminRole("")).toBe(false);
  });

  it("rejects non-string values", () => {
    expect(hasInstanceAdminRole(null)).toBe(false);
    expect(hasInstanceAdminRole(undefined)).toBe(false);
  });
});

describe("withInstanceAdminRole", () => {
  it("removes admin and keeps the other tokens in order", () => {
    expect(withInstanceAdminRole("user,admin", false)).toBe("user");
    expect(withInstanceAdminRole("sales,admin,user", false)).toBe("sales,user");
  });

  it("appends admin to an existing role list", () => {
    expect(withInstanceAdminRole("user", true)).toBe("user,admin");
  });

  it("falls back to user when removing admin empties the list", () => {
    expect(withInstanceAdminRole("admin", false)).toBe("user");
  });

  it("treats a missing role as user", () => {
    expect(withInstanceAdminRole(null, true)).toBe("user,admin");
    expect(withInstanceAdminRole(undefined, false)).toBe("user");
  });

  it("leaves a list that already has admin unchanged", () => {
    expect(withInstanceAdminRole("user,admin", true)).toBe("user,admin");
  });

  it("drops empty tokens so a demotion never stores an empty role", () => {
    expect(withInstanceAdminRole("admin,", false)).toBe("user");
    expect(withInstanceAdminRole(",admin", false)).toBe("user");
    expect(withInstanceAdminRole("user,admin,", false)).toBe("user");
    expect(withInstanceAdminRole("user,", true)).toBe("user,admin");
    expect(withInstanceAdminRole("", true)).toBe("user,admin");
  });
});
