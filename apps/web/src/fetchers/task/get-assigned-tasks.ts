import { client } from "@kaneo/libs";
import { HttpError } from "@/lib/http-error";
import type { AssignedTasksData } from "@/types/my-tasks";

async function getAssignedTasks(): Promise<AssignedTasksData> {
  const response = await client.user.tasks.$get();

  if (!response.ok) {
    throw new HttpError(response.status, "Failed to fetch assigned tasks");
  }

  const json = await response.json();

  return json.data;
}

export default getAssignedTasks;
