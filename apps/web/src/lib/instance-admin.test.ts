import { describe, expect, it } from "vite-plus/test";
import { hasInstanceAdminRole } from "./instance-admin";

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
