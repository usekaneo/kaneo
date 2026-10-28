import { describe, expect, it } from "vite-plus/test";
import { getWorkspaceRoleLabel } from "./get-workspace-role-label";

const t = (key: string) => `t(${key})`;

describe("getWorkspaceRoleLabel", () => {
  it("translates built-in roles", () => {
    expect(getWorkspaceRoleLabel("viewer", t)).toBe("t(team:roles.viewer)");
    expect(getWorkspaceRoleLabel("owner", t)).toBe("t(team:roles.owner)");
  });

  it("shows custom role names as they were written", () => {
    expect(getWorkspaceRoleLabel("Contractor", t)).toBe("Contractor");
    expect(getWorkspaceRoleLabel("constructor", t)).toBe("constructor");
  });

  it("lists every role of a member with several", () => {
    expect(getWorkspaceRoleLabel("admin,Designer", t)).toBe(
      "t(team:roles.admin), Designer",
    );
  });
});
