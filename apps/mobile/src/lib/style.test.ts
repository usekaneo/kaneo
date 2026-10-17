import { describe, expect, it } from "vite-plus/test";
import {
  hasRole,
  LABEL_COLORS,
  priorityLabel,
  ROLE_HINTS,
  roleLabel,
} from "./style";

describe("hasRole", () => {
  it("finds a role among comma-separated roles", () => {
    expect(hasRole("admin,viewer", "admin")).toBe(true);
    expect(hasRole("member", "owner")).toBe(false);
    expect(hasRole(null, "owner")).toBe(false);
  });
});

describe("roleLabel", () => {
  it("labels known roles and joins comma-separated ones", () => {
    expect(roleLabel("owner")).toBe("Owner");
    expect(roleLabel("admin,viewer")).toBe("Admin, Viewer");
  });

  it("capitalizes custom roles", () => {
    expect(roleLabel("auditor")).toBe("Auditor");
  });
});

describe("translated constants", () => {
  it("resolves labels and hints when read", () => {
    expect(priorityLabel("urgent")).toBe("Urgent");
    expect(priorityLabel(null)).toBe("No priority");
    expect(LABEL_COLORS[0].label).toBe("Stone");
    expect(ROLE_HINTS.viewer).toBe("Can view projects and tasks");
    expect(ROLE_HINTS.auditor).toBeUndefined();
  });
});
