import { client } from "@kaneo/libs";

async function reorderProjects(
  workspaceId: string,
  projects: Array<{ id: string; position: number }>,
) {
  const response = await client.project.reorder.$put({
    query: { workspaceId },
    json: { projects },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  return response.json();
}

export default reorderProjects;
