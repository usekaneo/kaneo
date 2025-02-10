import { api } from '@kaneo/libs';

async function getProjects({ workspaceId }: { workspaceId: string }) {
  if (!workspaceId) return;

  const response = await api.project.list({ workspaceId }).get();

  if (response.error) {
    throw new Error(response.error.value.message);
  }

  return response?.data;
}

export default getProjects;
