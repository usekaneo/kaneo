import { beforeEach, describe, expect, it, vi } from "vitest";
import { admin, member, viewer } from "../../../packages/permissions/src/index";

const { state } = vi.hoisted(() => ({
  state: {
    granterRole: null as string | null,
    customRoles: {} as Record<string, Record<string, string[]>>,
  },
}));

vi.mock("../../../apps/api/src/database", () => ({
  default: {},
  schema: {},
}));

vi.mock("../../../apps/api/src/utils/require-workspace-permission", () => ({
  getMemberRole: async () => state.granterRole,
  getRoleStatements: async (_workspaceId: string, role: string) => {
    const builtIns: Record<string, Record<string, readonly string[]>> = {
      viewer: viewer.statements,
      member: member.statements,
      admin: admin.statements,
    };
    return state.customRoles[role] ?? builtIns[role] ?? null;
  },
}));

const { canGrantRole } = await import(
  "../../../apps/api/src/utils/can-grant-role"
);

function grant(role: unknown, isInstanceAdmin = false) {
  return canGrantRole({
    workspaceId: "ws-1",
    userId: "user-1",
    role,
    isInstanceAdmin,
  });
}

describe("canGrantRole", () => {
  beforeEach(() => {
    state.granterRole = null;
    state.customRoles = {};
  });

  it("lets an owner grant any non-owner role", async () => {
    state.granterRole = "owner";

    expect(await grant("admin")).toBe(true);
    expect(await grant("viewer")).toBe(true);
  });

  it("lets an admin grant admin, member and viewer but never owner", async () => {
    state.granterRole = "admin";

    expect(await grant("admin")).toBe(true);
    expect(await grant("member")).toBe(true);
    expect(await grant("viewer")).toBe(true);
    expect(await grant("owner")).toBe(false);
  });

  it("stops a custom invite-only role from handing out admin", async () => {
    state.granterRole = "recruiter";
    state.customRoles.recruiter = {
      ...member.statements,
      invitation: ["create"],
    };

    expect(await grant("admin")).toBe(false);
    expect(await grant("member")).toBe(true);
  });

  it("checks custom target roles by their stored permissions", async () => {
    state.granterRole = "member";
    state.customRoles.auditor = { task: ["read"] };
    state.customRoles.manager = { task: ["delete"] };

    expect(await grant("auditor")).toBe(true);
    expect(await grant("manager")).toBe(false);
  });

  it("refuses callers who are not members of the workspace", async () => {
    state.granterRole = null;

    expect(await grant("viewer")).toBe(false);
  });

  it("lets an instance admin grant anything", async () => {
    expect(await grant("admin", true)).toBe(true);
  });

  it("defers unknown roles to Better Auth's ROLE_NOT_FOUND error", async () => {
    state.granterRole = "member";

    expect(await grant("does-not-exist")).toBe(true);
  });
});
