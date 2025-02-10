import { api } from '@kaneo/libs';

async function getWorkspace({ workspaceId }: { workspaceId: string }) {
  const response = await api.workspace({ id: workspaceId }).get();

  if (response.error?.value.message) {
    throw new Error(response.error.value.message);
  }

  return response.data;
}

export default getWorkspace;
