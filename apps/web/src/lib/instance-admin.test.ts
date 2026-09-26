import { describe, expect, it } from "vitest";
import { hasInstanceAdminRole } from "./instance-admin";

describe("hasInstanceAdminRole", () => {
  it("accepts a plain admin role", () => {
    expect(hasInstanceAdminRole("admin")).toBe(true);
  });

  it("accepts admin inside a comma-separated role list", () => {
    expect(hasInstanceAdminRole("user,admin")).toBe(true);
    expect(hasInstanceAdminRole(" admin , user")).toBe(true);
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
