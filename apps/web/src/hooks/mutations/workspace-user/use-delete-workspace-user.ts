import { useMutation } from "@tanstack/react-query";

import deleteWorkspaceUser from "@/fetchers/workspace-user/delete-workspace-user";

function useDeleteWorkspaceUser() {
  return useMutation({
    mutationFn: ({
      workspaceId,
      userEmail,
    }: { workspaceId: string; userEmail: string }) =>
      deleteWorkspaceUser({ workspaceId, userEmail }),
  });
}

export default useDeleteWorkspaceUser;
