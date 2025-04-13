import { api } from "@kaneo/libs";

const updateWorkspace = async ({
  workspaceId,
  userEmail,
  name,
  description,
}: {
  workspaceId: string;
  userEmail: string;
  name: string;
  description: string;
}) => {
  const response = await api
    .workspace({ id: workspaceId })
    .put({ name, description }, { headers: { "x-user-email": userEmail } });

  if (response.error) {
    throw new Error(response.error.value.message);
  }

  return response.data;
};

export default updateWorkspace;
