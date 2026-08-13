import { describe, expect, it } from "vitest";
import {
  formatBlockedWorkspacesMessage,
  hasOwnerRole,
  planAccountDeletion,
  type WorkspaceMembershipSummary,
} from "../../../apps/api/src/user/account-deletion";

function membership(
  overrides: Partial<WorkspaceMembershipSummary> = {},
): WorkspaceMembershipSummary {
  return {
    workspaceId: "workspace-1",
    workspaceName: "Acme",
    isOwner: true,
    memberCount: 1,
    ownerCount: 1,
    ...overrides,
  };
}

describe("hasOwnerRole", () => {
  it("matches a plain owner role", () => {
    expect(hasOwnerRole("owner")).toBe(true);
  });

  it("matches owner inside a comma separated role list", () => {
    expect(hasOwnerRole("admin,owner")).toBe(true);
    expect(hasOwnerRole("member, Owner ")).toBe(true);
  });

  it("does not match other roles", () => {
    expect(hasOwnerRole("admin")).toBe(false);
    expect(hasOwnerRole("ownership")).toBe(false);
  });
});

describe("planAccountDeletion", () => {
  it("deletes a workspace nobody else belongs to", () => {
    const plan = planAccountDeletion([membership()]);

    expect(plan.workspaceIdsToDelete).toEqual(["workspace-1"]);
    expect(plan.workspaceIdsToLeave).toEqual([]);
    expect(plan.blockedWorkspaceNames).toEqual([]);
  });

  it("blocks when the account is the only owner of a shared workspace", () => {
    const plan = planAccountDeletion([
      membership({ memberCount: 3, ownerCount: 1 }),
    ]);

    expect(plan.blockedWorkspaceNames).toEqual(["Acme"]);
    expect(plan.workspaceIdsToDelete).toEqual([]);
    expect(plan.workspaceIdsToLeave).toEqual([]);
  });

  it("leaves a shared workspace that keeps another owner", () => {
    const plan = planAccountDeletion([
      membership({ memberCount: 3, ownerCount: 2 }),
    ]);

    expect(plan.workspaceIdsToLeave).toEqual(["workspace-1"]);
    expect(plan.blockedWorkspaceNames).toEqual([]);
  });

  it("leaves workspaces the account does not own", () => {
    const plan = planAccountDeletion([
      membership({ isOwner: false, memberCount: 4, ownerCount: 1 }),
    ]);

    expect(plan.workspaceIdsToLeave).toEqual(["workspace-1"]);
  });

  it("plans each workspace independently", () => {
    const plan = planAccountDeletion([
      membership({ workspaceId: "solo" }),
      membership({
        workspaceId: "shared",
        workspaceName: "Shared",
        memberCount: 2,
        ownerCount: 1,
      }),
      membership({
        workspaceId: "guest",
        isOwner: false,
        memberCount: 5,
        ownerCount: 1,
      }),
    ]);

    expect(plan.workspaceIdsToDelete).toEqual(["solo"]);
    expect(plan.blockedWorkspaceNames).toEqual(["Shared"]);
    expect(plan.workspaceIdsToLeave).toEqual(["guest"]);
  });

  it("returns an empty plan for an account without workspaces", () => {
    expect(planAccountDeletion([])).toEqual({
      blockedWorkspaceNames: [],
      workspaceIdsToDelete: [],
      workspaceIdsToLeave: [],
    });
  });
});

describe("formatBlockedWorkspacesMessage", () => {
  it("names a single workspace", () => {
    expect(formatBlockedWorkspacesMessage(["Acme"])).toBe(
      'You are the only owner of "Acme". Transfer ownership or delete it before deleting your account.',
    );
  });

  it("joins several workspaces", () => {
    expect(formatBlockedWorkspacesMessage(["Acme", "Globex", "Initech"])).toBe(
      'You are the only owner of "Acme", "Globex" and "Initech". Transfer ownership or delete them before deleting your account.',
    );
  });
});
