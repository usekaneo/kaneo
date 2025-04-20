import { useMutation } from "@tanstack/react-query";

import deleteWorkspaceUser, {
  type DeleteWorkspaceUserRequest,
} from "@/fetchers/workspace-user/delete-workspace-user";

function useDeleteWorkspaceUser() {
  return useMutation({
    mutationFn: ({ workspaceId, userEmail }: DeleteWorkspaceUserRequest) =>
      deleteWorkspaceUser({ workspaceId, userEmail }),
  });
}

export default useDeleteWorkspaceUser;
