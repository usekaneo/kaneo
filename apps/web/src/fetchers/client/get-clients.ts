import { client } from "@kaneo/libs";

async function getClients({ workspaceId }: { workspaceId: string }) {
  const response = await client.client.$get({
    query: { workspaceId },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  return response.json();
}

export default getClients;
