import { describe, expect, it } from "vite-plus/test";
import { viewer, member, admin, owner } from "./index";

describe("Quills workspace permissions", () => {
  it("keeps viewers read-only and requires an administrator for destructive or settings actions", () => {
    expect(viewer.authorize({ quills: ["read"] }).success).toBe(true);
    expect(viewer.authorize({ quills: ["create"] }).success).toBe(false);
    expect(member.authorize({ quills: ["create", "update"] }).success).toBe(
      true,
    );
    expect(member.authorize({ quills: ["delete"] }).success).toBe(false);
    expect(member.authorize({ quills: ["manage_settings"] }).success).toBe(
      false,
    );
    for (const role of [admin, owner])
      expect(
        role.authorize({ quills: ["delete", "manage_settings"] }).success,
      ).toBe(true);
  });
});
