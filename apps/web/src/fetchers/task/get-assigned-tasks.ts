import { client } from "@kaneo/libs";
import { HttpError } from "@/lib/http-error";
import type { AssignedTasksData } from "@/types/my-tasks";

async function getAssignedTasks(): Promise<AssignedTasksData> {
  // No page or limit: the first page at the server default is loaded, and
  // the view filters client-side over it.
  const response = await client.user.tasks.$get({ query: {} });

  if (!response.ok) {
    throw new HttpError(response.status, "Failed to fetch assigned tasks");
  }

  const json = await response.json();

  return { ...json.data, pagination: json.pagination };
}

export default getAssignedTasks;
