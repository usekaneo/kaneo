import { client } from "@kaneo/libs";

async function ensureDefaultClient({ workspaceId }: { workspaceId: string }) {
  const response = await client.client["ensure-default"].$post({
    json: { workspaceId },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  return response.json();
}

export default ensureDefaultClient;
