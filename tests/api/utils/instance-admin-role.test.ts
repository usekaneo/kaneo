import { describe, expect, it } from "vitest";
import { hasInstanceAdminRole } from "../../../apps/api/src/utils/instance-admin-role";

describe("hasInstanceAdminRole", () => {
  it.each(["admin", "user,admin", " admin , user", "admin,"])(
    "accepts %j",
    (role) => {
      expect(hasInstanceAdminRole(role)).toBe(true);
    },
  );

  it.each(["user", "administrator", "", "user,owner", null, undefined, 1])(
    "rejects %j",
    (role) => {
      expect(hasInstanceAdminRole(role)).toBe(false);
    },
  );
});
