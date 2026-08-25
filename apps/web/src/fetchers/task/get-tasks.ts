import { client } from "@kaneo/libs";

async function getTasks(projectId: string) {
  const response = await client.task.tasks[":projectId"].$get({
    param: { projectId },
    // No filters: the route returns the whole board on a single page.
    query: {},
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  const json = await response.json();

  return json.data;
}

export default getTasks;
