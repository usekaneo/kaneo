import { describe, expect, it } from "vite-plus/test";
import { roleAllows, rolesAllow, satisfies } from "./role-permissions";

const workspaceRead = { workspace: ["read"] };

describe("roleAllows", () => {
  it("uses the built-in statements when no permission is stored", () => {
    expect(roleAllows("viewer", null, workspaceRead)).toBe(true);
    expect(roleAllows("viewer", undefined, { task: ["create"] })).toBe(false);
  });

  it("prefers the stored permission over the built-in statements", () => {
    const stored = JSON.stringify({ task: ["read"] });

    expect(roleAllows("member", stored, workspaceRead)).toBe(false);
    expect(roleAllows("member", stored, { task: ["read"] })).toBe(true);
  });

  it("reads a custom role from its stored permission only", () => {
    expect(roleAllows("custom", null, workspaceRead)).toBe(false);
    expect(
      roleAllows("custom", JSON.stringify(workspaceRead), workspaceRead),
    ).toBe(true);
  });

  it("falls back to the built-in statements when the stored JSON is malformed", () => {
    expect(roleAllows("viewer", "{not json", workspaceRead)).toBe(true);
    expect(roleAllows("custom", "{not json", workspaceRead)).toBe(false);
  });

  it("ignores malformed entries in the stored permission", () => {
    const stored = JSON.stringify({
      workspace: "read",
      task: ["read", 1],
    });

    expect(roleAllows("custom", stored, workspaceRead)).toBe(false);
    expect(roleAllows("custom", stored, { task: ["read"] })).toBe(true);
  });
});

describe("rolesAllow", () => {
  const noRead = JSON.stringify({ task: ["read"] });
  const read = JSON.stringify(workspaceRead);

  it("allows when any role grants the permission", () => {
    expect(
      rolesAllow(
        ["limited", "reader"],
        [
          { role: "limited", permission: noRead },
          { role: "reader", permission: read },
        ],
        workspaceRead,
      ),
    ).toBe(true);
    expect(
      rolesAllow(
        ["limited", "viewer"],
        [{ role: "limited", permission: noRead }],
        workspaceRead,
      ),
    ).toBe(true);
  });

  it("denies when no role grants the permission", () => {
    expect(
      rolesAllow(
        ["limited", "viewer"],
        [
          { role: "limited", permission: noRead },
          { role: "viewer", permission: noRead },
        ],
        workspaceRead,
      ),
    ).toBe(false);
    expect(rolesAllow([], [], workspaceRead)).toBe(false);
  });

  it("allows when any duplicate row for a role grants the permission", () => {
    for (const stored of [
      [
        { role: "custom", permission: noRead },
        { role: "custom", permission: read },
      ],
      [
        { role: "custom", permission: read },
        { role: "custom", permission: noRead },
      ],
    ]) {
      expect(rolesAllow(["custom"], stored, workspaceRead)).toBe(true);
    }
  });

  it("ignores stored rows for roles the member does not have", () => {
    expect(
      rolesAllow(
        ["limited"],
        [
          { role: "limited", permission: noRead },
          { role: "reader", permission: read },
        ],
        workspaceRead,
      ),
    ).toBe(false);
  });
});

describe("satisfies", () => {
  it("requires every action of every resource", () => {
    const statements = { task: ["read", "update"], label: ["read"] };

    expect(satisfies(statements, { task: ["read", "update"] })).toBe(true);
    expect(satisfies(statements, { task: ["delete"] })).toBe(false);
    expect(satisfies(statements, { workspace: ["read"] })).toBe(false);
  });
});
