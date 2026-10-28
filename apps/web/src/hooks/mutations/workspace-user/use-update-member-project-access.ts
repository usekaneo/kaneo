import { useMutation, useQueryClient } from "@tanstack/react-query";
import updateMemberProjectAccess from "@/fetchers/workspace-user/update-member-project-access";

function useUpdateMemberProjectAccess() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateMemberProjectAccess,
    onSuccess: (_data, { workspaceId }) => {
      queryClient.invalidateQueries({
        queryKey: ["workspace-users", workspaceId],
      });
      queryClient.invalidateQueries({
        queryKey: ["active-workspace-users", workspaceId],
      });
      queryClient.invalidateQueries({ queryKey: ["projects", workspaceId] });
    },
  });
}

export default useUpdateMemberProjectAccess;
