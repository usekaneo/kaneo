import { api } from "@kaneo/libs";

async function updateProject({
  id,
  workspaceId,
  name,
  description,
  icon,
  slug,
}: {
  id: string;
  workspaceId: string;
  name: string;
  description: string;
  icon: string;
  slug: string;
}) {
  const response = await api.project({ id }).put({
    workspaceId,
    name,
    description,
    icon,
    slug,
  });

  if (response.error) {
    throw new Error(response.error.value.message);
  }

  return response?.data;
}

export default updateProject;
