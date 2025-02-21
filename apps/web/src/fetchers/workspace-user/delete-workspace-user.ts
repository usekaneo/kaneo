import { api } from "@kaneo/libs/src/eden";

async function deleteWorkspaceUser({
  workspaceId,
  userEmail,
}: { workspaceId: string; userEmail: string }) {
  const response = await api["workspace-user"]({ workspaceId })({
    userEmail,
  }).delete();

  if (response.error) {
    throw new Error(response.error.value.message);
  }

  return response.data;
}

export default deleteWorkspaceUser;
