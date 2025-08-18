import { useMutation } from "@tanstack/react-query";

import deleteWorkspaceUser, {
  type DeleteWorkspaceUserRequest,
} from "@/fetchers/workspace-user/delete-workspace-user";

function useDeleteWorkspaceUser() {
  return useMutation({
    mutationFn: ({ workspaceId, userId }: DeleteWorkspaceUserRequest) =>
      deleteWorkspaceUser({ workspaceId, userId }),
  });
}

export default useDeleteWorkspaceUser;
