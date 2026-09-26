import { describe, expect, it } from "vitest";
import { isBanActive } from "../../../apps/api/src/utils/user-ban";

describe("isBanActive", () => {
  it("is inactive when the flag is unset or false", () => {
    expect(isBanActive(undefined)).toBe(false);
    expect(isBanActive({ banned: null })).toBe(false);
    expect(isBanActive({ banned: false, banExpires: new Date() })).toBe(false);
  });

  it("is active for an open-ended ban", () => {
    expect(isBanActive({ banned: true })).toBe(true);
    expect(isBanActive({ banned: true, banExpires: null })).toBe(true);
  });

  it("follows the expiry of a temporary ban", () => {
    const hour = 60 * 60 * 1000;
    expect(
      isBanActive({ banned: true, banExpires: new Date(Date.now() + hour) }),
    ).toBe(true);
    expect(
      isBanActive({
        banned: true,
        banExpires: new Date(Date.now() - hour).toISOString(),
      }),
    ).toBe(false);
  });
});
