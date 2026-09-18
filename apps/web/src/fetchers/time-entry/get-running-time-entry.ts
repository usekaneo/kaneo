import { client } from "@kaneo/libs";

async function getRunningTimeEntry(workspaceId: string) {
  const response = await client["time-entry"].running.$get({
    query: { workspaceId },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  return response.json();
}

export default getRunningTimeEntry;
