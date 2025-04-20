import { client } from "@kaneo/libs";

const getWorkspaces = async () => {
  const response = await client.workspace.$get();

  const workspaces = await response.json();

  return workspaces;
};

export default getWorkspaces;
