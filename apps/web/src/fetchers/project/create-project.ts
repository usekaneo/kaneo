import { api } from '@kaneo/libs';

async function createProject({
  name,
  slug,
  workspaceId,
  icon,
}: {
  name: string;
  slug: string;
  workspaceId: string;
  icon: string;
}) {
  const response = await api.project.create.post({
    name,
    workspaceId,
    icon,
    slug,
  });

  if (response.error) {
    throw new Error(response.error.value.message);
  }

  return response;
}

export default createProject;
