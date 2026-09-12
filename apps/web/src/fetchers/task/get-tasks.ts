import { client } from "@kaneo/libs";
import { HttpError } from "@/lib/http-error";

async function getTasks(projectId: string) {
  const response = await client.task.tasks[":projectId"].$get({
    param: { projectId },
    // No filters: the route returns the whole board on a single page.
    query: {},
  });

  if (!response.ok) {
    throw new HttpError(response.status, "Failed to fetch tasks");
  }

  const json = await response.json();

  return json.data;
}

export default getTasks;
