import { describe, expect, it } from "vite-plus/test";
import {
  hasUserFilters,
  NO_USER_FILTERS,
  toAdminUserFilters,
} from "./user-filters";

describe("toAdminUserFilters", () => {
  it("sends only the filters that are set", () => {
    expect(toAdminUserFilters(NO_USER_FILTERS)).toEqual({});
    expect(
      toAdminUserFilters({
        status: "deactivated",
        role: "",
        emailVerified: "false",
      }),
    ).toEqual({ status: "deactivated", emailVerified: "false" });
  });

  it("knows when any filter is set", () => {
    expect(hasUserFilters(NO_USER_FILTERS)).toBe(false);
    expect(hasUserFilters({ ...NO_USER_FILTERS, role: "admin" })).toBe(true);
  });
});
