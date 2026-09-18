import { describe, expect, it } from "vitest";
import {
  ac,
  admin,
  builtInRoles,
  coversPermissions,
  DEFAULT_ROLE_NAMES,
  defaultRolePayloads,
  manager,
  member,
  owner,
  statement,
  viewer,
} from "./index";

describe("@kaneo/permissions statement surface", () => {
  it("exposes Kaneo's resource statements alongside better-auth defaults", () => {
    expect(statement.project).toEqual([
      "create",
      "read",
      "update",
      "delete",
      "share",
    ]);
    expect(statement.task).toEqual([
      "create",
      "read",
      "update",
      "delete",
      "assign",
    ]);
    expect(statement.label).toEqual(["create", "read", "update", "delete"]);
    expect(statement.workspace).toEqual([
      "read",
      "update",
      "delete",
      "manage_settings",
    ]);
    // The organization plugin's defaults must still be present so we can
    // reuse them in member/admin/owner roles without breaking better-auth
    // checks like organization:update.
    expect(statement.organization).toBeDefined();
    expect(statement.member).toBeDefined();
  });

  it("returns the same `ac` instance for downstream consumers", () => {
    expect(ac).toBeDefined();
    expect(typeof ac.newRole).toBe("function");
  });
});

describe("built-in role privileges", () => {
  it("viewer can read but cannot create or modify", () => {
    expect(viewer.statements.project).toEqual(["read"]);
    expect(viewer.statements.task).toEqual(["read"]);
    expect(viewer.statements.label).toEqual(["read"]);
    expect(viewer.statements.workspace).toEqual(["read"]);
  });

  it("member can create/read/update tasks but not delete or manage settings", () => {
    expect(member.statements.task).toContain("create");
    expect(member.statements.task).toContain("update");
    expect(member.statements.task).not.toContain("delete");
    expect(member.statements.project).toContain("create");
    expect(member.statements.project).not.toContain("delete");
    expect(member.statements.workspace).toEqual(["read"]);
  });

  it("admin can delete tasks and manage workspace settings but cannot delete the workspace", () => {
    expect(admin.statements.task).toContain("delete");
    expect(admin.statements.task).toContain("assign");
    expect(admin.statements.project).toContain("delete");
    expect(admin.statements.project).toContain("share");
    expect(admin.statements.workspace).toContain("manage_settings");
    expect(admin.statements.workspace).not.toContain("delete");
  });

  it("owner has every Kaneo resource action including workspace:delete", () => {
    expect(owner.statements.task).toEqual(
      expect.arrayContaining(["create", "read", "update", "delete", "assign"]),
    );
    expect(owner.statements.project).toEqual(
      expect.arrayContaining(["create", "read", "update", "delete", "share"]),
    );
    expect(owner.statements.workspace).toEqual(
      expect.arrayContaining(["read", "update", "delete", "manage_settings"]),
    );
  });

  it("groups all five roles under builtInRoles by name", () => {
    expect(Object.keys(builtInRoles).sort()).toEqual([
      "admin",
      "manager",
      "member",
      "owner",
      "viewer",
    ]);
    expect(builtInRoles.manager).toBe(manager);
    expect(builtInRoles.viewer).toBe(viewer);
    expect(builtInRoles.member).toBe(member);
    expect(builtInRoles.admin).toBe(admin);
    expect(builtInRoles.owner).toBe(owner);
  });
});

describe("default-role seed payloads", () => {
  it("names the seedable defaults but excludes owner (kept as static role)", () => {
    expect(DEFAULT_ROLE_NAMES).toEqual([
      "viewer",
      "member",
      "manager",
      "admin",
    ]);
    expect(DEFAULT_ROLE_NAMES).not.toContain("owner");
    expect(Object.keys(defaultRolePayloads).sort()).toEqual([
      "admin",
      "manager",
      "member",
      "viewer",
    ]);
  });

  it("emits JSON-serializable payloads that mirror each role's compiled statements", () => {
    for (const name of DEFAULT_ROLE_NAMES) {
      const role = builtInRoles[name];
      const payload = defaultRolePayloads[name];

      // Every resource the compiled role declares must appear in the payload
      // with the same set of actions (order-insensitive). Otherwise a seeded
      // workspace_role row would silently drift from the static role.
      for (const [resource, actions] of Object.entries(role.statements)) {
        expect(payload[resource]).toBeDefined();
        expect([...payload[resource]].sort()).toEqual([...actions].sort());
      }

      // Round-trips through JSON without loss; the API stores these as text.
      const roundTripped = JSON.parse(JSON.stringify(payload));
      expect(roundTripped).toEqual(payload);
    }
  });

  it("returns a fresh mutable array per resource so callers can edit safely", () => {
    const memberPayload = defaultRolePayloads.member;
    memberPayload.task.push("__test_marker");
    // Re-import-equivalent check: the in-memory payload is mutable but the
    // role object's statements are decoupled (we only mutated the copy).
    expect(memberPayload.task).toContain("__test_marker");
    expect(member.statements.task).not.toContain("__test_marker");
  });
});

describe("coversPermissions", () => {
  it("lets a role grant any role that is equal or weaker", () => {
    expect(coversPermissions([admin.statements], [member.statements])).toBe(
      true,
    );
    expect(coversPermissions([member.statements], [viewer.statements])).toBe(
      true,
    );
    expect(coversPermissions([member.statements], [member.statements])).toBe(
      true,
    );
  });

  it("refuses to grant a role with permissions the granter lacks", () => {
    expect(coversPermissions([member.statements], [admin.statements])).toBe(
      false,
    );
    expect(coversPermissions([viewer.statements], [member.statements])).toBe(
      false,
    );
  });

  it("combines the permissions of every role the granter holds", () => {
    const inviteOnly = { invitation: ["create"] };
    const target = { invitation: ["create"], task: ["read"] };

    expect(coversPermissions([inviteOnly], [target])).toBe(false);
    expect(coversPermissions([inviteOnly, { task: ["read"] }], [target])).toBe(
      true,
    );
  });
});

describe("timeEntry permissions", () => {
  it("lets only owner and admin see or manage other people's time", () => {
    expect(statement.timeEntry).toEqual(["read_all", "manage_all"]);
    expect(owner.statements.timeEntry).toEqual(["read_all", "manage_all"]);
    expect(admin.statements.timeEntry).toEqual(["read_all", "manage_all"]);
    expect(
      (member.statements as Record<string, unknown>).timeEntry,
    ).toBeUndefined();
    expect(
      (viewer.statements as Record<string, unknown>).timeEntry,
    ).toBeUndefined();
  });
});

describe("company permissions", () => {
  it("keeps pay and the audit log away from managers and employees", () => {
    for (const role of [manager, member, viewer]) {
      const statements = role.statements as Record<string, unknown>;
      expect(statements.payroll).toBeUndefined();
      expect(statements.audit).toBeUndefined();
    }
    expect(admin.statements.payroll).toEqual(["read", "manage"]);
    expect(owner.statements.audit).toEqual(["read"]);
  });

  it("lets managers see their team and approve requests, but not manage people", () => {
    expect(manager.statements.people).toEqual(["read_all"]);
    expect(manager.statements.request).toEqual(["approve"]);
    expect(manager.statements.timeEntry).toEqual(["read_all"]);
    expect(coversPermissions([admin.statements], [manager.statements])).toBe(
      true,
    );
    expect(coversPermissions([manager.statements], [admin.statements])).toBe(
      false,
    );
  });
});

describe("file permissions", () => {
  it("lets everyone who works in the workspace upload, and admins manage", () => {
    expect(member.statements.file).toEqual(["upload"]);
    expect(manager.statements.file).toEqual(["upload"]);
    expect(admin.statements.file).toEqual(["upload", "manage"]);
    expect(owner.statements.file).toEqual(["upload", "manage"]);
    expect((viewer.statements as Record<string, unknown>).file).toBeUndefined();
  });
});
