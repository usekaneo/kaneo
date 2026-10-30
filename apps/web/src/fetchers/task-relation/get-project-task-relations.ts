import { client } from "@kaneo/libs";

async function getProjectTaskRelations(projectId: string) {
  const response = await client["task-relation"].project[":projectId"].$get({
    param: { projectId },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  return response.json();
}

export default getProjectTaskRelations;
