import { api } from '@kaneo/libs';

const inviteWorkspaceMember = async ({
  workspaceId,
  userEmail,
}: {
  workspaceId: string;
  userEmail: string;
}) => {
  const response = await api['workspace-user']({ workspaceId }).invite.post({
    workspaceId,
    userEmail,
  });

  return response.data;
};

export default inviteWorkspaceMember;
