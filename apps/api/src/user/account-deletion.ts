export type WorkspaceMembershipSummary = {
  workspaceId: string;
  workspaceName: string;
  isOwner: boolean;
  memberCount: number;
  ownerCount: number;
};

export type AccountDeletionPlan = {
  blockedWorkspaceNames: string[];
  workspaceIdsToDelete: string[];
  workspaceIdsToLeave: string[];
};

export function hasOwnerRole(role: string) {
  return role
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .includes("owner");
}

export function planAccountDeletion(
  memberships: WorkspaceMembershipSummary[],
): AccountDeletionPlan {
  const plan: AccountDeletionPlan = {
    blockedWorkspaceNames: [],
    workspaceIdsToDelete: [],
    workspaceIdsToLeave: [],
  };

  for (const membership of memberships) {
    if (membership.memberCount <= 1) {
      plan.workspaceIdsToDelete.push(membership.workspaceId);
      continue;
    }

    if (membership.isOwner && membership.ownerCount <= 1) {
      plan.blockedWorkspaceNames.push(membership.workspaceName);
      continue;
    }

    plan.workspaceIdsToLeave.push(membership.workspaceId);
  }

  return plan;
}

export function formatBlockedWorkspacesMessage(names: string[]) {
  const quoted = names.map((name) => `"${name}"`);
  const list =
    quoted.length === 1
      ? quoted[0]
      : `${quoted.slice(0, -1).join(", ")} and ${quoted[quoted.length - 1]}`;

  return `You are the only owner of ${list}. Transfer ownership or delete ${names.length === 1 ? "it" : "them"} before deleting your account.`;
}
