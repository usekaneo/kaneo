import { client } from "@kaneo/libs";
import { HttpError } from "@/lib/http-error";

type GetTasksFilters = {
  type?: "task" | "epic";
};

async function getTasks(projectId: string, filters: GetTasksFilters = {}) {
  const response = await client.task.tasks[":projectId"].$get({
    param: { projectId },
    // Everything else is unpaginated: the route returns the whole board (or,
    // with `type`, every task of that type across it) on a single page.
    query: filters.type ? { type: filters.type } : {},
  });

  if (!response.ok) {
    throw new HttpError(response.status, "Failed to fetch tasks");
  }

  const json = await response.json();

  return json.data;
}

export default getTasks;
