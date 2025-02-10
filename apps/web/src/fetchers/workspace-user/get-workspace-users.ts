import { api } from '@kaneo/libs';

async function getWorkspaceUsers({ workspaceId }: { workspaceId: string }) {
  const response = await api['workspace-user']
    .list({ workspaceId: workspaceId })
    .get();

  if (response.error) {
    throw new Error(response.error.value.message);
  }

  return response.data;
}

export default getWorkspaceUsers;
