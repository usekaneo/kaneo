import { useMutation, useQueryClient } from "@tanstack/react-query";
import { authClient } from "@/lib/auth-client";

type TransferOwnershipRequest = {
  workspaceId: string;
  newOwnerMemberId: string;
  currentOwnerMemberId: string;
};

// better-auth 1.6.9 has no dedicated transfer-ownership endpoint, so we
// perform two sequential updateMemberRole calls:
//
//   1. promote the new owner (allowed because the current user is owner)
//   2. demote the old owner to admin (now safe: the workspace still has
//      another owner, so the "you cannot leave the organization as the only
//      owner" check passes)
//
// Order matters: if we demoted first, step 2 would 403 because no owner
// would be left. If step 2 fails, the workspace ends up with two owners —
// recoverable by re-running the demote.
function useTransferWorkspaceOwnership() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      workspaceId,
      newOwnerMemberId,
      currentOwnerMemberId,
    }: TransferOwnershipRequest) => {
      const promote = await authClient.organization.updateMemberRole({
        memberId: newOwnerMemberId,
        organizationId: workspaceId,
        role: "owner",
      });
      if (promote.error) {
        throw new Error(promote.error.message || "Failed to promote new owner");
      }

      const demote = await authClient.organization.updateMemberRole({
        memberId: currentOwnerMemberId,
        organizationId: workspaceId,
        role: "admin",
      });
      if (demote.error) {
        throw new Error(
          demote.error.message || "Failed to demote previous owner",
        );
      }

      return demote.data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["workspace", "full", variables.workspaceId],
      });
      queryClient.invalidateQueries({
        queryKey: ["workspace-users", variables.workspaceId],
      });
      queryClient.invalidateQueries({
        queryKey: ["workspace-user", "active"],
      });
      queryClient.invalidateQueries({
        queryKey: ["workspace-capabilities", variables.workspaceId],
      });
      queryClient.invalidateQueries({ queryKey: ["active-organization"] });
    },
  });
}

export default useTransferWorkspaceOwnership;
