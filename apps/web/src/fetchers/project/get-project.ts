import { api } from '@kaneo/libs';

async function getProject({
  id,
  workspaceId,
}: {
  id: string;
  workspaceId: string;
}) {
  const response = await api.project({ id }).get({ query: { workspaceId } });

  if (response.error) {
    throw new Error(response.error.value.message);
  }

  return response?.data;
}

export default getProject;
