import inviteWorkspaceMember from '@/fetchers/workspace-user/invite-workspace-member';
import { useMutation } from '@tanstack/react-query';

function useInviteWorkspaceUser() {
  return useMutation({
    mutationFn: ({
      workspaceId,
      userEmail,
    }: {
      workspaceId: string;
      userEmail: string;
    }) => inviteWorkspaceMember({ workspaceId, userEmail }),
  });
}

export default useInviteWorkspaceUser;
