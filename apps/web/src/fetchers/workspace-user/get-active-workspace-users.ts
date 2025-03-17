import { api } from "@kaneo/libs";

async function getActiveWorkspaceUsers(workspaceId: string) {
  const response = await api["workspace-user"]({ workspaceId }).active.get();

  if (response.error) {
    throw new Error(response.error.value.message);
  }

  return response.data;
}

export default getActiveWorkspaceUsers;
