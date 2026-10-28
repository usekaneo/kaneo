import { CUSTOM_ROLE_PERMISSIONS } from "@kaneo/permissions";
import { describe, expect, it } from "vite-plus/test";
import { PERMISSION_GROUPS } from "./permission-groups";

describe("PERMISSION_GROUPS", () => {
  it("lists every custom role permission once", () => {
    const listed = PERMISSION_GROUPS.flatMap((group) =>
      group.permissions.map((entry) => entry.permission),
    );
    expect([...listed].sort()).toEqual([...CUSTOM_ROLE_PERMISSIONS].sort());
  });
});
